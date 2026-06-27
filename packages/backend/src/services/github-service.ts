export interface GitHubUser {
  id: number
  login: string
  email: string | null
  avatar_url: string
  name: string | null
}

export class GitHubServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'GitHubServiceError'
  }
}

export async function exchangeCode(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    client_secret: process.env.GITHUB_CLIENT_SECRET ?? '',
    code,
  })

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: params,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new GitHubServiceError(
      `GitHub token exchange failed with status ${response.status}`,
      502
    )
  }

  const data = await response.json() as Record<string, unknown>

  if (data.error) {
    throw new GitHubServiceError(
      `GitHub OAuth error: ${data.error_description ?? data.error}`,
      401
    )
  }

  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw new GitHubServiceError('GitHub did not return an access token', 502)
  }

  return data.access_token
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (response.status === 401) {
    throw new GitHubServiceError('GitHub access token is invalid or expired', 401)
  }

  if (!response.ok) {
    throw new GitHubServiceError(
      `GitHub user fetch failed with status ${response.status}`,
      502
    )
  }

  const user = await response.json() as GitHubUser

  if (!user.id || !user.login) {
    throw new GitHubServiceError('GitHub returned an incomplete user object', 502)
  }

  return user
}
