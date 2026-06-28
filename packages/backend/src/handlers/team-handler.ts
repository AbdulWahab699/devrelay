import type { FastifyRequest, FastifyReply } from "fastify"
import { db } from "../db/connection.js"

interface UpdateTeamBody {
  name?: string
  slug?: string
  receiverSlackId?: string
}

export async function getCurrentTeam(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { teamId } = request.user as { teamId: string }

    const team = await db
      .selectFrom("teams")
      .selectAll()
      .where("id", "=", teamId)
      .executeTakeFirst()

    if (!team) {
      return reply.status(404).send({ error: "Team not found" })
    }

    return reply.send({ team })
  } catch (err) {
    request.log.error(err, "[getCurrentTeam] error")
    return reply.status(500).send({ error: "Failed to fetch team" })
  }
}

export async function updateCurrentTeam(
  request: FastifyRequest<{ Body: UpdateTeamBody }>,
  reply: FastifyReply
) {
  try {
    const { teamId } = request.user as { teamId: string }
    const { name, slug, receiverSlackId } = request.body

    const updates: Record<string, string> = {}
    if (name) updates.name = name
    if (slug) updates.slug = slug
    if (receiverSlackId) updates.receiver_slack_id = receiverSlackId

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No fields to update" })
    }

    const team = await db
      .updateTable("teams")
      .set(updates)
      .where("id", "=", teamId)
      .returningAll()
      .executeTakeFirst()

    return reply.send({ team })
  } catch (err) {
    request.log.error(err, "[updateCurrentTeam] error")
    return reply.status(500).send({ error: "Failed to update team" })
  }
}