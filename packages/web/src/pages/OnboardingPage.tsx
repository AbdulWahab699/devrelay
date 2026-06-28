import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth-store"
import { apiRequest } from "../lib/api"

type Step = 1 | 2 | 3 | 4 | 5

const STEP_LABELS = ["Team", "Slack", "Receiver", "Review", "Done"]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const jwt = useAuthStore(s => s.jwt)
  const [step, setStep] = useState<Step>(1)
  const [teamName, setTeamName] = useState("")
  const [receiverId, setReceiverId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("devrelay-onboarding-step")
    if (saved) setStep(parseInt(saved) as Step)
    setTimeout(() => setMounted(true), 50)
  }, [])

  useEffect(() => {
    localStorage.setItem("devrelay-onboarding-step", String(step))
  }, [step])

  const slug = teamName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  const handleCreateTeam = async () => {
    if (!teamName.trim()) { setError("Team name is required."); return }
    setLoading(true); setError(null)
    try {
      await apiRequest("/teams/current", {
        method: "PUT",
        body: JSON.stringify({ name: teamName, slug }),
      })
      setStep(2)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectSlack = () => {
    const clientId = import.meta.env.VITE_SLACK_CLIENT_ID ?? ""
    if (!clientId) { setStep(3); return }
    window.location.href =
      "https://slack.com/oauth/v2/authorize" +
      "?client_id=" + clientId +
      "&scope=chat:write,users:read" +
      "&redirect_uri=" + encodeURIComponent(window.location.origin + "/onboarding")
  }

  const handleSetReceiver = async () => {
    if (!receiverId.trim()) { setError("Slack user ID is required."); return }
    setLoading(true); setError(null)
    try {
      await apiRequest("/teams/current", {
        method: "PUT",
        body: JSON.stringify({ receiverSlackId: receiverId }),
      })
      setStep(4)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = () => {
    localStorage.removeItem("devrelay-onboarding-step")
    navigate("/handoffs")
  }

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={s.bgRadial} />

      <div style={{
        ...s.card,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)",
      }}>

        <div style={s.brand}>
          <div style={s.brandIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#051F20" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style={s.brandText}>DevRelay</span>
        </div>

        <div style={s.stepperWrap}>
          <div style={s.stepperTrack}>
            {STEP_LABELS.map((_, i) => {
              const n = i + 1
              const completed = n < step
              const active = n === step
              return (
                <div key={n} style={s.stepItem}>
                  <div style={{
                    ...s.stepCircle,
                    background: completed ? "#00F5D4" : active ? "transparent" : "#163832",
                    border: completed ? "none" : active ? "2px solid #00F5D4" : "2px solid #235347",
                  }}>
                    {completed ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#051F20" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : active ? (
                      <div style={s.stepDot} />
                    ) : null}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{
                      ...s.stepLine,
                      background: completed ? "#00F5D4" : "#235347",
                    }} />
                  )}
                </div>
              )
            })}
          </div>
          <div style={s.stepMeta}>
            <span style={s.stepLabel}>{STEP_LABELS[step - 1]}</span>
            <span style={s.stepCount}>{step} of {STEP_LABELS.length}</span>
          </div>
        </div>

        <div style={s.content} key={step}>
          {step === 1 && <StepCreateTeam teamName={teamName} slug={slug} error={error} loading={loading} onChange={setTeamName} onContinue={handleCreateTeam} />}
          {step === 2 && <StepConnectSlack onConnect={handleConnectSlack} onSkip={() => setStep(3)} />}
          {step === 3 && <StepSetReceiver receiverId={receiverId} error={error} loading={loading} onChange={setReceiverId} onContinue={handleSetReceiver} onSkip={() => setStep(4)} />}
          {step === 4 && <StepReview teamName={teamName} slug={slug} receiverId={receiverId} onFinish={handleFinish} />}
          {step === 5 && <StepDone onFinish={handleFinish} />}
        </div>
      </div>
    </div>
  )
}

function StepCreateTeam({ teamName, slug, error, loading, onChange, onContinue }: {
  teamName: string; slug: string; error: string | null
  loading: boolean; onChange: (v: string) => void; onContinue: () => void
}) {
  return (
    <div style={s.step}>
      <div>
        <h2 style={s.stepHeading}>Create your team</h2>
        <p style={s.stepSub}>Set up a workspace to manage handoffs with your team.</p>
      </div>
      {error && <ErrorBox message={error} />}
      <div style={s.fieldWrap}>
        <label style={s.label}>TEAM NAME</label>
        <input
          style={s.input}
          placeholder="Acme Engineering"
          value={teamName}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onContinue()}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#00F5D4"}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(142,182,155,0.15)"}
          autoFocus
        />
        {slug && (
          <p style={s.slugPreview}>
            devrelay.app/<span style={{ color: "#00F5D4" }}>{slug}</span>
          </p>
        )}
      </div>
      <p style={s.stepExplain}>
        DevRelay groups your handoff briefs by team. Each member can run the CLI to generate and publish briefs.
      </p>
      <CTAButton onClick={onContinue} loading={loading}>Continue →</CTAButton>
    </div>
  )
}

function StepConnectSlack({ onConnect, onSkip }: {
  onConnect: () => void; onSkip: () => void
}) {
  return (
    <div style={s.step}>
      <div>
        <h2 style={s.stepHeading}>Connect Slack</h2>
        <p style={s.stepSub}>Deliver handoff briefs directly to your teammate's DMs.</p>
      </div>
      <div style={s.slackCard}>
        <div style={s.slackIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#E01E5A"/>
            <path d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
            <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z" fill="#36C5F0"/>
            <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
            <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z" fill="#2EB67D"/>
            <path d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
            <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z" fill="#ECB22E"/>
            <path d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E"/>
          </svg>
        </div>
        <p style={{ fontSize: "14px", color: "#8EB69B", textAlign: "center", lineHeight: 1.6 }}>
          Add DevRelay to your Slack workspace to enable DM delivery to your incoming engineer.
        </p>
      </div>
      <p style={s.stepExplain}>
        DevRelay requires <code style={s.code}>chat:write</code> and <code style={s.code}>users:read</code> scopes only. No message history access.
      </p>
      <CTAButton onClick={onConnect}>Add to Slack</CTAButton>
      <button style={s.skipBtn} onClick={onSkip}>Skip for now — configure in Settings</button>
    </div>
  )
}

function StepSetReceiver({ receiverId, error, loading, onChange, onContinue, onSkip }: {
  receiverId: string; error: string | null; loading: boolean
  onChange: (v: string) => void; onContinue: () => void; onSkip: () => void
}) {
  return (
    <div style={s.step}>
      <div>
        <h2 style={s.stepHeading}>Set your receiver</h2>
        <p style={s.stepSub}>Who should receive the Slack DM when a handoff is published?</p>
      </div>
      {error && <ErrorBox message={error} />}
      <div style={s.fieldWrap}>
        <label style={s.label}>SLACK USER ID</label>
        <input
          style={s.input}
          placeholder="U01ABCDEF12"
          value={receiverId}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onContinue()}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#00F5D4"}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(142,182,155,0.15)"}
          autoFocus
        />
        <p style={s.slugPreview}>In Slack: click a profile → ··· More → Copy member ID</p>
      </div>
      <p style={s.stepExplain}>
        This is the Slack user ID of the engineer taking over. They will receive a DM with the full handoff brief when you run <code style={s.code}>devrelay publish</code>.
      </p>
      <CTAButton onClick={onContinue} loading={loading}>Continue →</CTAButton>
      <button style={s.skipBtn} onClick={onSkip}>Skip for now</button>
    </div>
  )
}

function StepReview({ teamName, slug, receiverId, onFinish }: {
  teamName: string; slug: string; receiverId: string; onFinish: () => void
}) {
  return (
    <div style={s.step}>
      <div>
        <h2 style={s.stepHeading}>You&apos;re all set</h2>
        <p style={s.stepSub}>Here&apos;s a summary of your setup.</p>
      </div>
      <div style={s.reviewCard}>
        <ReviewRow label="Team" value={teamName || "—"} />
        <ReviewRow label="Slug" value={slug ? "devrelay.app/" + slug : "—"} mono />
        <ReviewRow label="Receiver" value={receiverId || "Not configured"} mono />
        <ReviewRow label="Slack" value="Configure in Settings" />
      </div>
      <CTAButton onClick={onFinish}>Go to Dashboard →</CTAButton>
    </div>
  )
}

function StepDone({ onFinish }: { onFinish: () => void }) {
  return (
    <div style={{ ...s.step, alignItems: "center", textAlign: "center" }}>
      <div style={s.doneIcon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#051F20" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 style={s.stepHeading}>Setup complete</h2>
      <p style={s.stepSub}>Run <code style={s.code}>devrelay handoff</code> from your terminal to create your first brief.</p>
      <CTAButton onClick={onFinish}>Open Dashboard →</CTAButton>
    </div>
  )
}

function CTAButton({ children, onClick, loading }: {
  children: React.ReactNode; onClick: () => void; loading?: boolean
}) {
  return (
    <button
      style={{ ...s.cta, opacity: loading ? 0.6 : 1 }}
      onClick={onClick}
      disabled={loading}
      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#00D2B4"}
      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "#00F5D4"}
    >
      {loading ? <div style={s.spinner} /> : children}
    </button>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={s.errorBox}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={s.reviewRow}>
      <span style={s.reviewLabel}>{label}</span>
      <span style={{ ...s.reviewValue, fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(ellipse 120% 80% at 50% 100%, #0d3b2e 0%, #051F20 50%, #030e0f 100%)",
    position: "relative",
    overflow: "hidden",
    padding: "24px",
    fontFamily: '"Comic Sans MS", cursive',
  },
  bgRadial: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "800px",
    height: "400px",
    background: "radial-gradient(ellipse 800px 400px at 50% 0%, rgba(0,245,212,0.04) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "rgba(11, 43, 38, 0.65)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(142,182,155,0.15)",
    borderRadius: "16px",
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "28px",
    position: "relative",
    zIndex: 1,
  },
  brand: { display: "flex", alignItems: "center", gap: "8px" },
  brandIcon: {
    width: "28px", height: "28px", background: "#00F5D4",
    borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  brandText: { fontSize: "16px", fontWeight: 600, color: "#E2F1E7", letterSpacing: "-0.01em" },
  stepperWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  stepperTrack: { display: "flex", alignItems: "center" },
  stepItem: { display: "flex", alignItems: "center", flex: 1 },
  stepCircle: {
    width: "22px", height: "22px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "all 200ms ease",
  },
  stepDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#00F5D4" },
  stepLine: { flex: 1, height: "1px", margin: "0 4px", transition: "background 200ms ease" },
  stepMeta: { display: "flex", justifyContent: "space-between" },
  stepLabel: { fontSize: "11px", color: "#8EB69B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" },
  stepCount: { fontSize: "11px", color: "#235347" },
  content: { animation: "fadeUp 0.3s ease forwards" },
  step: { display: "flex", flexDirection: "column", gap: "20px" },
  stepHeading: { fontSize: "22px", fontWeight: 600, color: "#E2F1E7", letterSpacing: "-0.02em", marginBottom: "6px" },
  stepSub: { fontSize: "14px", color: "#8EB69B", lineHeight: 1.6 },
  stepExplain: {
    fontSize: "13px", color: "#235347", lineHeight: 1.6,
    padding: "12px 14px", background: "rgba(22,56,50,0.4)",
    borderRadius: "8px", border: "1px solid rgba(142,182,155,0.08)",
  },
  fieldWrap: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "11px", fontWeight: 500, color: "#8EB69B", letterSpacing: "0.06em", textTransform: "uppercase" },
  input: {
    width: "100%", height: "42px", background: "#163832",
    border: "1px solid rgba(142,182,155,0.15)", borderRadius: "10px",
    color: "#E2F1E7", fontSize: "14px", padding: "0 14px",
    fontFamily: '"Comic Sans MS", cursive', outline: "none", transition: "border-color 150ms ease",
  },
  slugPreview: { fontSize: "12px", color: "#235347", fontFamily: "monospace", marginTop: "2px", paddingLeft: "2px" },
  cta: {
    width: "100%", height: "42px", background: "#00F5D4", border: "none",
    borderRadius: "10px", color: "#051F20", fontSize: "14px", fontWeight: 600,
    cursor: "pointer", fontFamily: '"Comic Sans MS", cursive',
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 150ms ease", letterSpacing: "-0.01em",
  },
  skipBtn: {
    background: "none", border: "none", color: "#235347", fontSize: "13px",
    cursor: "pointer", fontFamily: '"Comic Sans MS", cursive',
    textAlign: "center", padding: "4px", transition: "color 150ms ease",
  },
  errorBox: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "10px 14px", background: "rgba(255,107,107,0.08)",
    border: "1px solid rgba(255,107,107,0.2)", borderRadius: "8px",
    fontSize: "13px", color: "#FF6B6B",
  },
  slackCard: {
    padding: "24px", background: "#163832",
    border: "1px solid rgba(142,182,155,0.15)", borderRadius: "12px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
  },
  slackIcon: {
    width: "52px", height: "52px", background: "rgba(22,56,50,0.6)",
    borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  reviewCard: {
    background: "#163832", border: "1px solid rgba(142,182,155,0.15)",
    borderRadius: "10px", overflow: "hidden",
  },
  reviewRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px", borderBottom: "1px solid rgba(142,182,155,0.08)",
  },
  reviewLabel: { fontSize: "11px", fontWeight: 500, color: "#8EB69B", letterSpacing: "0.06em", textTransform: "uppercase" },
  reviewValue: { fontSize: "13px", color: "#E2F1E7" },
  doneIcon: {
    width: "56px", height: "56px", background: "#00F5D4",
    borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
  },
  code: { fontFamily: "monospace", fontSize: "12px", background: "#163832", padding: "2px 6px", borderRadius: "4px", color: "#00F5D4" },
  spinner: {
    width: "16px", height: "16px",
    border: "2px solid rgba(5,31,32,0.3)", borderTopColor: "#051F20",
    borderRadius: "50%", animation: "spin 0.7s linear infinite",
  },
}
