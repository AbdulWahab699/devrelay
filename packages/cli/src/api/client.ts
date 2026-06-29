import { loadConfig, saveConfig } from "../config/store.ts"

const BASE_URL = process.env.DEVRELAY_API_URL ?? "http://localhost:3001"
const TIMEOUT_MS = 25000

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export class TimeoutError extends Error {
  constructor() {
    super("Request timed out. Draft may still be processing. Run devrelay status to check.")
    this.name = "TimeoutError"
  }
}

async function safeParseBody(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      const json = await response.json()
      return typeof json === "string" ? json : JSON.stringify(json)
    } catch {
      return "Invalid JSON response from server"
    }
  }
  const text = await response.text()
  if (text.includes("<html") || text.includes("<!DOCTYPE")) {
    return `Server error (${response.status}) — gateway returned an HTML error page`
  }
  return text || `HTTP ${response.status}`
}

async function safeParseJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    const text = await response.text()
    throw new ApiError(
      response.status,
      `Expected JSON but received ${contentType || "unknown"}. Body: ${text.slice(0, 100)}`
    )
  }
  try {
    return await response.json() as T
  } catch {
    throw new ApiError(response.status, "Failed to parse JSON response from server")
  }
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new TimeoutError()
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function refreshJwt(): Promise<string | null> {
  const config = loadConfig()
  if (!config?.refreshToken) return null
  try {
    const response = await fetch(BASE_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: config.refreshToken }),
    })
    if (!response.ok) return null
    const data = await safeParseJson<{ jwt: string }>(response)
    saveConfig({ ...config, jwt: data.jwt })
    return data.jwt
  } catch {
    return null
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = loadConfig()
  const jwt = config?.jwt

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  // Only set Content-Type when there is a body — fixes empty body 400 errors
  if (options.body) {
    headers["Content-Type"] = "application/json"
  }

  if (jwt) headers["Authorization"] = "Bearer " + jwt

  const response = await fetchWithTimeout(BASE_URL + path, { ...options, headers })

  if (response.status === 401) {
    const newJwt = await refreshJwt()
    if (newJwt) {
      headers["Authorization"] = "Bearer " + newJwt
      const retryResponse = await fetchWithTimeout(BASE_URL + path, { ...options, headers })
      if (!retryResponse.ok) {
        throw new ApiError(retryResponse.status, await safeParseBody(retryResponse))
      }
      return safeParseJson<T>(retryResponse)
    }
    throw new ApiError(401, "Session expired. Run devrelay auth login.")
  }

  if (!response.ok) {
    throw new ApiError(response.status, await safeParseBody(response))
  }

  return safeParseJson<T>(response)
}