import { useAuthStore } from "../stores/auth-store"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001"
const TIMEOUT_MS = 25000

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new ApiError(408, "Request timed out")
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { jwt } = useAuthStore.getState()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (jwt) headers["Authorization"] = "Bearer " + jwt

  const response = await fetchWithTimeout(BASE_URL + path, { ...options, headers })

  if (response.status === 401) {
    useAuthStore.getState().clearAuth()
    window.location.href = "/login"
    throw new ApiError(401, "Session expired")
  }

  if (!response.ok) {
    const text = await response.text()
    let message = text
    try { message = (JSON.parse(text) as { message?: string }).message ?? text } catch { /* keep text */ }
    throw new ApiError(response.status, message)
  }

  return response.json() as Promise<T>
}