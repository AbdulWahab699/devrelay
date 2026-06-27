import type { FastifyRequest, FastifyReply } from "fastify"
import crypto from "crypto"
import { exchangeCode, getGitHubUser, GitHubServiceError } from "../services/github-service.js"
import { db } from "../db/connection.js"

interface GitHubAuthBody {
  code: string
}

interface GitHubDeviceAuthBody {
  accessToken: string
}

interface RefreshBody {
  refreshToken: string
}

// Shared logic — upsert user + team, issue JWT + refresh token
async function createSession(
  accessToken: string,
  reply: FastifyReply
) {
  const githubUser = await getGitHubUser(accessToken)

  const existingUser = await db
    .selectFrom("users")
    .selectAll()
    .where("github_id", "=", String(githubUser.id))
    .executeTakeFirst()

  let userId: string
  let isNewUser = false

  if (existingUser) {
    await db
      .updateTable("users")
      .set({
        email: githubUser.email,
        display_name: githubUser.name,
        avatar_url: githubUser.avatar_url,
      })
      .where("id", "=", existingUser.id)
      .execute()
    userId = existingUser.id
  } else {
    const newUser = await db
      .insertInto("users")
      .values({
        github_id: String(githubUser.id),
        email: githubUser.email,
        display_name: githubUser.name,
        avatar_url: githubUser.avatar_url,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
    userId = newUser.id
    isNewUser = true
  }

  const existingMembership = await db
    .selectFrom("team_members")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst()

  let teamId: string
  let teamSlug: string

  if (!existingMembership) {
    const baseSlug = githubUser.login.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-team"
    let resolvedTeamId: string | null = null
    let resolvedSlug: string = baseSlug
    let attempts = 0

    while (!resolvedTeamId && attempts < 5) {
      const slug = attempts === 0
        ? baseSlug
        : baseSlug + "-" + crypto.randomBytes(3).toString("hex")

      try {
        const newTeam = await db
          .insertInto("teams")
          .values({
            slug,
            name: (githubUser.name ?? githubUser.login) + "s Team",
          })
          .returning(["id", "slug"])
          .executeTakeFirstOrThrow()
        resolvedTeamId = newTeam.id
        resolvedSlug = newTeam.slug
      } catch (err: unknown) {
        const pgErr = err as { code?: string }
        if (pgErr?.code === "23505") {
          attempts++
          continue
        }
        throw err
      }
    }

    if (!resolvedTeamId) {
      throw new Error("Failed to create team after 5 slug collision attempts")
    }

    teamId = resolvedTeamId
    teamSlug = resolvedSlug

    await db
      .insertInto("team_members")
      .values({
        team_id: teamId,
        user_id: userId,
        role: "admin",
      })
      .execute()
  } else {
    teamId = existingMembership.team_id
    const team = await db
      .selectFrom("teams")
      .select("slug")
      .where("id", "=", teamId)
      .executeTakeFirst()
    teamSlug = team?.slug ?? "my-team"
  }

  const jwt = await reply.jwtSign(
    { userId, teamId, displayName: githubUser.name ?? githubUser.login },
    { expiresIn: "15m" }
  )

  const refreshToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db
    .insertInto("refresh_tokens")
    .values({
      user_id: userId,
      token: refreshToken,
      expires_at: expiresAt,
      revoked: false,
    })
    .execute()

  return {
    jwt,
    refreshToken,
    isNewUser,
    teamSlug,
    user: {
      id: userId,
      githubId: String(githubUser.id),
      displayName: githubUser.name ?? githubUser.login,
      email: githubUser.email,
      avatarUrl: githubUser.avatar_url,
    },
  }
}

// Web OAuth flow — exchanges code first
export async function handleGitHubAuth(
  request: FastifyRequest<{ Body: GitHubAuthBody }>,
  reply: FastifyReply
) {
  const { code } = request.body

  try {
    const accessToken = await exchangeCode(code)
    const session = await createSession(accessToken, reply)
    return reply.status(200).send(session)
  } catch (err) {
    if (err instanceof GitHubServiceError) {
      return reply.status(err.statusCode).send({
        error: "GitHub Auth Failed",
        message: err.message,
      })
    }
    request.log.error(err, "[handleGitHubAuth] Unexpected error")
    return reply.status(500).send({
      error: "Internal Server Error",
      message: "Authentication failed. Please try again.",
    })
  }
}

// Device flow — accessToken already obtained by CLI polling
export async function handleGitHubDeviceAuth(
  request: FastifyRequest<{ Body: GitHubDeviceAuthBody }>,
  reply: FastifyReply
) {
  const { accessToken } = request.body

  try {
    const session = await createSession(accessToken, reply)
    return reply.status(200).send(session)
  } catch (err) {
    if (err instanceof GitHubServiceError) {
      return reply.status(err.statusCode).send({
        error: "GitHub Auth Failed",
        message: err.message,
      })
    }
    request.log.error(err, "[handleGitHubDeviceAuth] Unexpected error")
    return reply.status(500).send({
      error: "Internal Server Error",
      message: "Authentication failed. Please try again.",
    })
  }
}

export async function handleRefresh(
  request: FastifyRequest<{ Body: RefreshBody }>,
  reply: FastifyReply
) {
  const { refreshToken } = request.body

  try {
    const result = await db.transaction().execute(async (trx) => {
      const tokenRow = await trx
        .selectFrom("refresh_tokens")
        .selectAll()
        .where("token", "=", refreshToken)
        .forUpdate()
        .executeTakeFirst()

      if (!tokenRow) return { error: "invalid", message: "Invalid refresh token. Run devrelay auth login." }
      if (tokenRow.revoked) return { error: "revoked", message: "Refresh token has been revoked. Run devrelay auth login." }
      if (new Date() > new Date(tokenRow.expires_at)) return { error: "expired", message: "Refresh token has expired. Run devrelay auth login." }

      await trx.updateTable("refresh_tokens").set({ revoked: true }).where("id", "=", tokenRow.id).execute()

      await trx
        .deleteFrom("refresh_tokens")
        .where("user_id", "=", tokenRow.user_id)
        .where("revoked", "=", true)
        .where("expires_at", "<", new Date())
        .execute()

      const user = await trx.selectFrom("users").selectAll().where("id", "=", tokenRow.user_id).executeTakeFirst()
      if (!user) return { error: "nouser", message: "User no longer exists. Run devrelay auth login." }

      const membership = await trx.selectFrom("team_members").selectAll().where("user_id", "=", user.id).executeTakeFirst()
      if (!membership) return { error: "noteam", message: "User has no team. Run devrelay auth login." }

      return { user, teamId: membership.team_id }
    })

    if ("error" in result) {
      return reply.status(401).send({ error: "Unauthorized", message: result.message })
    }

    const { user, teamId } = result

    const newJwt = await reply.jwtSign(
      { userId: user.id, teamId, displayName: user.display_name ?? user.github_id },
      { expiresIn: "15m" }
    )

    const newRefreshToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await db
      .insertInto("refresh_tokens")
      .values({ user_id: user.id, token: newRefreshToken, expires_at: expiresAt, revoked: false })
      .execute()

    return reply.status(200).send({ jwt: newJwt, refreshToken: newRefreshToken })
  } catch (err) {
    request.log.error(err, "[handleRefresh] Unexpected error")
    return reply.status(500).send({ error: "Internal Server Error", message: "Token refresh failed." })
  }
}

export async function handleMe(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const payload = request.user as { userId: string; teamId: string; displayName: string }

    const user = await db.selectFrom("users").selectAll().where("id", "=", payload.userId).executeTakeFirst()
    if (!user) return reply.status(404).send({ error: "Not Found", message: "User not found" })

    const team = await db.selectFrom("teams").selectAll().where("id", "=", payload.teamId).executeTakeFirst()

    return reply.status(200).send({ user, team })
  } catch (err) {
    request.log.error(err, "[handleMe] Unexpected error")
    return reply.status(500).send({ error: "Internal Server Error", message: "Failed to fetch user." })
  }
}