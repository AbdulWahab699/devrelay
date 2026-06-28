import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AuthUser {
  id: string
  displayName: string
  email: string | null
  avatarUrl: string | null
  githubId: string
}

interface AuthState {
  jwt: string | null
  refreshToken: string | null
  user: AuthUser | null
  teamId: string
  teamSlug: string
  setAuth: (jwt: string, refreshToken: string, user: AuthUser, teamSlug: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      jwt: null,
      refreshToken: null,
      user: null,
      teamId: "",
      teamSlug: "",

      setAuth: (jwt, refreshToken, user, teamSlug) =>
        set({ jwt, refreshToken, user, teamSlug }),

      clearAuth: () =>
        set({ jwt: null, refreshToken: null, user: null, teamId: "", teamSlug: "" }),

      isAuthenticated: () => {
        const { jwt } = get()
        return Boolean(jwt)
      },
    }),
    {
      name: "devrelay-auth",
    }
  )
)