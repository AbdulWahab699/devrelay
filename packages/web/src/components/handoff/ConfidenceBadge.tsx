type Confidence = 'high' | 'medium' | 'low'

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const config = {
    high:   { label: 'HIGH',   color: '#3CD070', bg: 'rgba(60,208,112,0.1)'  },
    medium: { label: 'MEDIUM', color: '#FFD166', bg: 'rgba(255,209,102,0.1)' },
    low:    { label: 'LOW',    color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)' },
  }[confidence]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: config.bg, border: '1px solid ' + config.color + '33', borderRadius: '6px', padding: '4px 10px' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
      <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: config.color, fontFamily: '"Comic Sans MS", cursive' }}>
        CONFIDENCE: {config.label}
      </span>
    </div>
  )
}
