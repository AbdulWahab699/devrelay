import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import type { HandoffBrief } from '@devrelay/shared'

interface Handoff {
  id: string
  status: 'draft' | 'awaiting_review' | 'published'
  brief_body: HandoffBrief | null
  created_at: string
  author_id: string
}

interface HandoffListResponse {
  items: Handoff[]
  hasMore: boolean
  nextCursor: string | null
  nextCursorId: string | null
}

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

function StatusBadge({ status }: { status: Handoff['status'] }) {
  const config = {
    draft: { label: 'DRAFT', color: '#235347', bg: '#163832', dot: '#235347' },
    awaiting_review: { label: 'AWAITING REVIEW', color: '#FFD166', bg: 'rgba(255,209,102,0.1)', dot: '#FFD166' },
    published: { label: 'PUBLISHED', color: '#3CD070', bg: 'rgba(60,208,112,0.1)', dot: '#3CD070' },
  }[status]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: config.dot, flexShrink: 0 }} />
      <span style={{
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.06em',
        color: config.color,
        background: config.bg,
        padding: '3px 8px',
        borderRadius: '4px',
        fontFamily: '"Comic Sans MS", cursive',
      }}>
        {config.label}
      </span>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div style={{
      background: 'rgba(11,43,38,0.65)',
      border: '1px solid rgba(142,182,155,0.15)',
      borderRadius: '10px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      opacity: 0.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#163832', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div style={{ height: '12px', width: '30%', background: '#163832', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: '12px', width: '60%', background: '#163832', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
      <div style={{ width: '80px', height: '24px', background: '#163832', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '64px 24px',
      border: '1px dashed rgba(142,182,155,0.15)',
      borderRadius: '10px',
      marginTop: '32px',
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: '#163832',
        border: '1px solid rgba(142,182,155,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#235347" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#8EB69B', marginBottom: '8px' }}>No handoffs yet</h3>
      <p style={{ fontSize: '13px', color: '#235347', marginBottom: '24px', maxWidth: '320px', lineHeight: 1.6 }}>
        Push your first handoff directly from your terminal to see it appear here.
      </p>
      <div style={{
        background: '#163832',
        border: '1px solid rgba(142,182,155,0.15)',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: 'monospace',
        fontSize: '13px',
      }}>
        <span style={{ color: '#00F5D4' }}>$</span>
        <span style={{ color: '#E2F1E7' }}>devrelay handoff</span>
      </div>
    </div>
  )
}

export default function HandoffListPage() {
  const navigate = useNavigate()
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<Handoff[]>([])

  const { data, isLoading } = useQuery<HandoffListResponse>({
    queryKey: ['handoffs', cursor],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)
      if (cursorId) params.set('cursorId', cursorId)
      return apiRequest<HandoffListResponse>('/handoffs?' + params.toString())
    },
  })

  useEffect(() => {
    if (data) {
      if (cursor) {
        setAllItems(prev => [...prev, ...data.items])
      } else {
        setAllItems(data.items)
      }
    }
  }, [data, cursor])

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor)
      setCursorId(data.nextCursorId)
    }
  }

  const displayItems = allItems.length > 0 ? allItems : (data?.items ?? [])

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1120px',
      margin: '0 auto',
      fontFamily: '"Comic Sans MS", cursive',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#E2F1E7',
          letterSpacing: '-0.02em',
        }}>
          Team Handoffs
        </h1>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#235347',
          background: '#163832',
          padding: '6px 12px',
          borderRadius: '9999px',
          border: '1px solid rgba(142,182,155,0.15)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          <span>New handoffs via CLI only</span>
        </div>
      </div>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isLoading && !allItems.length ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : displayItems.length === 0 ? (
          <EmptyState />
        ) : (
          displayItems.map(handoff => (
            <div
              key={handoff.id}
              onClick={() => navigate('/handoffs/' + handoff.id)}
              style={{
                background: 'rgba(11,43,38,0.65)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(142,182,155,0.15)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#163832'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(11,43,38,0.65)'}
            >
              {/* Left — avatar + info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#163832',
                  border: '1px solid rgba(142,182,155,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8EB69B',
                  fontSize: '13px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {handoff.author_id?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#E2F1E7' }}>
                      {handoff.author_id?.slice(0, 8) ?? 'Unknown'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#235347' }}>
                      · {timeAgo(handoff.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#8EB69B',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '500px',
                  }}>
                    {handoff.brief_body?.what_changed?.slice(0, 80) ?? 'Brief not yet generated'}
                  </div>
                </div>
              </div>

              {/* Right — badge + chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                <StatusBadge status={handoff.status} />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#235347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load more */}
      {data?.hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <button
            onClick={handleLoadMore}
            style={{
              background: 'rgba(11,43,38,0.65)',
              border: '1px solid rgba(142,182,155,0.15)',
              borderRadius: '8px',
              color: '#8EB69B',
              fontSize: '13px',
              padding: '10px 24px',
              cursor: 'pointer',
              fontFamily: '"Comic Sans MS", cursive',
              transition: 'border-color 150ms ease',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#00F5D4'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(142,182,155,0.15)'}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  )
}