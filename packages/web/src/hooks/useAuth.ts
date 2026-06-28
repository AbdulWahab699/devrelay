import { useAuthStore } from "../stores/auth-store"
import { useNavigate } from "react-router-dom"

export function useAuth() {
  const { jwt, user, teamSlug, setAuth, clearAuth, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const logout = () => {
    clearAuth()
    navigate("/login")
  }

  return { jwt, user, teamSlug, setAuth, logout, isAuthenticated }
}