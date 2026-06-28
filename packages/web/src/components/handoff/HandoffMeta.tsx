import type { HandoffDetail } from '../../hooks/useHandoff'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return days + 'd ago'
  if (hours > 0) return hours + 'h ago'
  if (mins > 0) return mins + 'm ago'
  return 'just now'
}

export function HandoffMeta({ handoff }: { handoff: HandoffDetail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#163832', border: '1px solid rgba(142,182,155,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8EB69B', fontSize: '13px', fontWeight: 600 }}>
          {handoff.author_id?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#E2F1E7', fontFamily: '"Comic Sans MS", cursive' }}>
            {handoff.author_id?.slice(0, 8) ?? 'Unknown'}
          </div>
          <div style={{ fontSize: '12px', color: '#235347', fontFamily: '"Comic Sans MS", cursive' }}>
            {handoff.published_at ? 'Published ' + timeAgo(handoff.published_at) : 'Created ' + timeAgo(handoff.created_at)}
          </div>
        </div>
      </div>
      {handoff.slack_ts && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3CD070', background: 'rgba(60,208,112,0.08)', border: '1px solid rgba(60,208,112,0.2)', borderRadius: '6px', padding: '4px 10px', fontFamily: '"Comic Sans MS", cursive' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Slack delivered
        </div>
      )}
    </div>
  )
}
