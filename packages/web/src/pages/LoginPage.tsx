import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth-store"

const TAGLINES = [
  "Ship briefs with confidence.",
  "Designed for distributed teams.",
  "Built for timezone handoffs.",
  "Context that never gets lost.",
]

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? ""
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, setAuth } = useAuthStore()
  
  // Typewriter States
  const [currentText, setCurrentText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [loopNum, setLoopNum] = useState(0)
  const [typingSpeed, setTypingSpeed] = useState(80)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) navigate("/handoffs")
  }, [])

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    if (!code) return

    setLoading(true)
    window.history.replaceState({}, "", "/login")

    fetch(API_URL + "/auth/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((data: {
        jwt: string
        refreshToken: string
        teamSlug: string
        user: { id: string; displayName: string; email: string | null; avatarUrl: string | null; githubId: string }
      }) => {
        setAuth(data.jwt, data.refreshToken, data.user, data.teamSlug)
        navigate(data.user ? "/handoffs" : "/onboarding")
      })
      .catch(() => setError("Authentication failed. Please try again."))
      .finally(() => setLoading(false))
  }, [])

  // Typewriter Effect Logic
  useEffect(() => {
    let timer = setTimeout(() => {
      const i = loopNum % TAGLINES.length
      const fullText = TAGLINES[i]

      if (isDeleting) {
        // Fast backspace effect
        setCurrentText(fullText.substring(0, currentText.length - 1))
        setTypingSpeed(30)
      } else {
        // Normal typing effect
        setCurrentText(fullText.substring(0, currentText.length + 1))
        setTypingSpeed(60)
      }

      if (!isDeleting && currentText === fullText) {
        // Pause at the end of the sentence
        timer = setTimeout(() => setIsDeleting(true), 2500)
      } else if (isDeleting && currentText === "") {
        // Switch to next tagline and pause before typing
        setIsDeleting(false)
        setLoopNum(loopNum + 1)
        setTypingSpeed(400)
      }
    }, typingSpeed)

    return () => clearTimeout(timer)
  }, [currentText, isDeleting, loopNum, typingSpeed])

  const handleGitHubLogin = () => {
    const url =
      "https://github.com/login/oauth/authorize" +
      "?client_id=" + GITHUB_CLIENT_ID +
      "&scope=read:user user:email" +
      "&redirect_uri=" + encodeURIComponent(window.location.origin + "/login")
    window.location.href = url
  }

  return (
    <div style={styles.root}>
      {/* Embedded Keyframes for Aesthetic Rendering */}
      <style>
        {`
          @keyframes cardReveal {
            0% { opacity: 0; transform: scale(0.96) translateY(20px); filter: blur(12px); }
            100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
          }
          @keyframes staggerFadeUp {
            0% { opacity: 0; transform: translateY(15px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes dividerDraw {
            0% { transform: scaleY(0); opacity: 0; }
            100% { transform: scaleY(1); opacity: 1; }
          }
          @keyframes cursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}
      </style>

      {/* Background arcs */}
      <div style={styles.bgArc1} />
      <div style={styles.bgArc2} />
      <div style={styles.bgArc3} />

      {/* Main split card */}
      <div style={styles.card}>

        {/* LEFT — visual panel */}
        <div style={styles.leftPanel}>
          <div style={styles.logo}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F5D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span style={styles.logoText}>DevRelay</span>
          </div>

          <div style={styles.taglineWrap}>
            <p style={styles.tagline}>
              {currentText}
              <span style={styles.cursor} />
            </p>
          </div>

          <p style={styles.leftSub}>
            Async handoff intelligence for<br />distributed engineering teams.
          </p>

          {/* Decorative dots */}
          <div style={styles.dots}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{
                ...styles.dot,
                animationDelay: i * 0.3 + "s",
                background: i === 0 ? "#00F5D4" : i === 1 ? "#3CD070" : "#8EB69B",
              }} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* RIGHT — login panel */}
        <div style={styles.rightPanel}>
          <div>
            <h1 style={styles.heading}>Welcome back</h1>
            <p style={styles.subheading}>
              Sign in to access your team&apos;s handoff briefs.
            </p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            style={{ ...styles.githubBtn, opacity: loading ? 0.6 : 1 }}
            onClick={handleGitHubLogin}
            disabled={loading}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,245,212,0.5)"
              ;(e.currentTarget as HTMLButtonElement).style.background = "rgba(22, 56, 50, 0.8)"
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(142, 182, 155, 0.2)"
              ;(e.currentTarget as HTMLButtonElement).style.background = "rgba(11, 43, 38, 0.4)"
            }}
          >
            {loading ? (
              <div style={styles.spinner} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#E2F1E7">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            )}
            <span>{loading ? "Signing in..." : "Continue with GitHub"}</span>
          </button>

          <p style={styles.legal}>
            By continuing you agree to our{" "}
            <span style={styles.legalLink}>Terms</span> and{" "}
            <span style={styles.legalLink}>Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(ellipse 120% 80% at 50% 100%, #0d3b2e 0%, #051F20 50%, #030e0f 100%)",
    position: "relative",
    overflow: "hidden",
    padding: "24px",
  },
  bgArc1: {
    position: "absolute",
    bottom: "-20%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "140vw",
    height: "140vw",
    border: "1px solid rgba(0,245,212,0.04)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  bgArc2: {
    position: "absolute",
    bottom: "-30%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "180vw",
    height: "180vw",
    border: "1px solid rgba(0,245,212,0.03)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  bgArc3: {
    position: "absolute",
    bottom: "-40%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "220vw",
    height: "220vw",
    border: "1px solid rgba(0,245,212,0.02)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  card: {
    display: "flex",
    width: "100%",
    maxWidth: "900px",
    minHeight: "480px",
    background: "rgba(11, 43, 38, 0.45)",
    backdropFilter: "blur(48px)",
    WebkitBackdropFilter: "blur(48px)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "32px",
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
    boxShadow: "0 0 0 1px rgba(0,245,212,0.06), 0 32px 80px rgba(0,0,0,0.5)",
    animation: "cardReveal 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards",
  },
  leftPanel: {
    flex: 1,
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    background: "rgba(5, 20, 18, 0.3)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    animation: "staggerFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
    animationFillMode: "both",
    animationDelay: "0.2s",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  logoText: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#E2F1E7",
    letterSpacing: "-0.01em",
  },
  taglineWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
  },
  tagline: {
    fontSize: "28px",
    fontWeight: 600,
    color: "#E2F1E7",
    lineHeight: 1.3,
    letterSpacing: "-0.02em",
    minHeight: "72px", // Prevents layout shift when text is empty or wrapping
  },
  cursor: {
    display: "inline-block",
    width: "3px",
    height: "26px",
    backgroundColor: "#00F5D4",
    marginLeft: "4px",
    verticalAlign: "text-bottom",
    animation: "cursorBlink 1s step-end infinite",
  },
  leftSub: {
    fontSize: "14px",
    color: "#8EB69B",
    lineHeight: 1.7,
  },
  dots: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    animation: "pulse-ring 2s ease-in-out infinite",
  },
  divider: {
    width: "1px",
    background: "rgba(142, 182, 155, 0.12)",
    flexShrink: 0,
    transformOrigin: "top",
    animation: "dividerDraw 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
    animationFillMode: "both",
    animationDelay: "0.35s",
  },
  rightPanel: {
    flex: 1,
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "28px",
    animation: "staggerFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
    animationFillMode: "both",
    animationDelay: "0.5s",
  },
  heading: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#E2F1E7",
    letterSpacing: "-0.02em",
    marginBottom: "8px",
  },
  subheading: {
    fontSize: "14px",
    color: "#8EB69B",
    lineHeight: 1.6,
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    background: "rgba(255, 107, 107, 0.08)",
    border: "1px solid rgba(255, 107, 107, 0.2)",
    borderRadius: "10px",
    fontSize: "13px",
    color: "#FF6B6B",
  },
  githubBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    height: "44px",
    background: "rgba(11, 43, 38, 0.4)",
    border: "1px solid rgba(142, 182, 155, 0.2)",
    borderRadius: "10px",
    color: "#E2F1E7",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "border-color 150ms ease, background 150ms ease",
    fontFamily: "inherit",
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(142,182,155,0.2)",
    borderTopColor: "#00F5D4",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  legal: {
    fontSize: "12px",
    color: "#235347",
    textAlign: "center",
    lineHeight: 1.6,
  },
  legalLink: {
    color: "#8EB69B",
    cursor: "pointer",
    textDecoration: "underline",
  },
}