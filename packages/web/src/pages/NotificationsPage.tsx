import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import { useNavigate } from 'react-router-dom'

interface HandoffEvent {
  id: string
  handoff_id: string
  event_type: string
  occurred_at: string
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return days + 'd ago'
  if (hours > 0) return hours + 'h ago'
  if (mins > 0) return mins + 'm ago'
  return 'just now'
}

const EVENT_ICONS: Record<string, string> = {
  draft_created: '📝',
  published:     '✅',
  slack_sent:    '💬',
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { data: events = [], isLoading } = useQuery<HandoffEvent[]>({
    queryKey: ['notifications'],
    queryFn: () => apiRequest<HandoffEvent[]>('/notifications'),
    staleTime: 30_000,
  })

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', fontFamily: '"Comic Sans MS", cursive' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#E2F1E7', marginBottom: '32px', letterSpacing: '-0.02em' }}>Notifications</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isLoading ? (
          [1,2,3].map(i => (
            <div key={i} style={{ height: '64px', background: '#163832', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#235347', fontSize: '14px' }}>No notifications yet.</div>
        ) : (
          events.map(ev => (
            <div
              key={ev.id}
              onClick={() => navigate('/handoffs/' + ev.handoff_id)}
              style={{ background: 'rgba(11,43,38,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '10px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 150ms ease' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#163832'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(11,43,38,0.65)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '20px' }}>{EVENT_ICONS[ev.event_type] ?? '🔔'}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#E2F1E7' }}>{ev.event_type.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '12px', color: '#235347', marginTop: '2px' }}>Handoff #{ev.handoff_id.slice(0, 8)}</div>
                </div>
              </div>
              <span style={{ fontSize: '12px', color: '#235347' }}>{timeAgo(ev.occurred_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}