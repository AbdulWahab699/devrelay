import { saveConfig, clearConfig } from "../config/store.ts"
import chalk from "chalk"

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ""
const BASE_URL = process.env.DEVRELAY_API_URL ?? "http://localhost:3001"

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

interface TokenResponse {
  access_token?: string
  error?: string
}

interface AuthResponse {
  jwt: string
  refreshToken: string
  teamSlug: string
  user: {
    id: string
    displayName: string
    email: string | null
    avatarUrl: string | null
  }
  isNewUser: boolean
}

async function getDeviceCode(): Promise<DeviceCodeResponse> {
  try {
    const response = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: "read:user user:email",
      }),
    })
    if (!response.ok) {
      throw new Error("Failed to initiate GitHub OAuth. Check your network connection.")
    }
    return response.json() as Promise<DeviceCodeResponse>
  } catch (err) {
    if ((err as Error).message.includes("fetch")) {
      throw new Error("Network error: Could not reach GitHub. Check your internet connection.")
    }
    throw err
  }
}

async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number
): Promise<string> {
  const deadline = Date.now() + expiresIn * 1000
  let currentInterval = interval

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, currentInterval * 1000))

    let data: TokenResponse
    try {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      })
      data = (await response.json()) as TokenResponse
    } catch {
      console.warn(chalk.yellow("Network hiccup — retrying in " + currentInterval + "s..."))
      continue
    }

    if (data.access_token) return data.access_token

    if (data.error === "access_denied") {
      throw new Error("Authorization denied. Run devrelay auth login to try again.")
    }

    if (data.error === "slow_down") {
      currentInterval += 5
      console.warn(chalk.yellow("Rate limited by GitHub — slowing poll to " + currentInterval + "s"))
      continue
    }
  }

  throw new Error("Authorization timed out. Run devrelay auth login to try again.")
}

export async function authLogin(): Promise<void> {
  if (!GITHUB_CLIENT_ID) {
    console.error(chalk.red("Error: GITHUB_CLIENT_ID not set in environment."))
    process.exit(1)
  }

  console.log(chalk.cyan("Connecting to GitHub..."))

  let deviceCode: DeviceCodeResponse
  try {
    deviceCode = await getDeviceCode()
  } catch (err) {
    console.error(chalk.red("Error:"), (err as Error).message)
    process.exit(1)
  }

  console.log("")
  console.log(chalk.bold("Your activation code:"), chalk.yellow.bold(deviceCode.user_code))
  console.log(chalk.dim("Open this URL and enter the code above:"))
  console.log(chalk.cyan(deviceCode.verification_uri))
  console.log("")
  console.log(chalk.dim("Waiting for authorization..."))

  let accessToken: string
  try {
    accessToken = await pollForToken(
      deviceCode.device_code,
      deviceCode.interval,
      deviceCode.expires_in
    )
  } catch (err) {
    console.error(chalk.red("Error:"), (err as Error).message)
    process.exit(1)
  }

  let auth: AuthResponse
  try {
    // Device flow — send accessToken directly to dedicated endpoint
    const apiUrl = BASE_URL + "/auth/github/device"
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    })
    if (!response.ok) {
      const errBody = await response.json() as { message?: string }
      throw new Error(errBody.message ?? "Failed to authenticate with DevRelay API.")
    }
    auth = (await response.json()) as AuthResponse
  } catch (err) {
    console.error(chalk.red("Error:"), (err as Error).message)
    process.exit(1)
  }

  saveConfig({
    jwt: auth.jwt,
    refreshToken: auth.refreshToken,
    userId: auth.user.id,
    teamId: "",
    displayName: auth.user.displayName,
    teamSlug: auth.teamSlug ?? "my-team",
  })

  console.log("")
  console.log(chalk.green("Authenticated as"), chalk.bold(auth.user.displayName))
  console.log(chalk.dim("Team:"), chalk.bold(auth.teamSlug ?? "my-team"))
}

export async function authLogout(): Promise<void> {
  clearConfig()
  console.log(chalk.green("Logged out successfully."))
}

export function authStatus(): void {
  const config = { jwt: null, displayName: "", teamSlug: "" }
  if (!config?.jwt) {
    console.log(chalk.yellow("Not authenticated. Run devrelay auth login."))
  }
}