import { useNavigate, useParams } from 'react-router-dom'
import { useHandoff } from '../hooks/useHandoff'
import { BriefSection } from '../components/handoff/BriefSection'
import { ConfidenceBadge } from '../components/handoff/ConfidenceBadge'
import { HandoffMeta } from '../components/handoff/HandoffMeta'

function StatusBadge({ status }: { status: 'draft' | 'awaiting_review' | 'published' }) {
  const config = {
    draft:           { label: 'DRAFT',           color: '#235347', bg: '#163832',                dot: '#235347' },
    awaiting_review: { label: 'AWAITING REVIEW', color: '#FFD166', bg: 'rgba(255,209,102,0.1)', dot: '#FFD166' },
    published:       { label: 'PUBLISHED',       color: '#3CD070', bg: 'rgba(60,208,112,0.1)',  dot: '#3CD070' },
  }[status]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: config.dot }} />
      <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', color: config.color, background: config.bg, padding: '3px 8px', borderRadius: '4px', fontFamily: '"Comic Sans MS", cursive' }}>
        {config.label}
      </span>
    </div>
  )
}

export default function HandoffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: handoff, isLoading, isError } = useHandoff(id ?? '')

  if (isLoading) {
    return (
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ height: '16px', width: '200px', background: '#163832', borderRadius: '4px', marginBottom: '32px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: '120px', background: '#163832', borderRadius: '10px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    )
  }

  if (isError || !handoff) {
    return (
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', textAlign: 'center', color: '#8EB69B', fontFamily: '"Comic Sans MS", cursive' }}>
        <p>Handoff not found.</p>
        <button onClick={() => navigate('/handoffs')} style={{ marginTop: '16px', background: 'none', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '8px', color: '#8EB69B', padding: '8px 16px', cursor: 'pointer', fontFamily: '"Comic Sans MS", cursive' }}>
          Back to Handoffs
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', fontFamily: '"Comic Sans MS", cursive' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } 
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '13px', color: '#235347' }}>
        <button onClick={() => navigate('/handoffs')} style={{ background: 'none', border: 'none', color: '#235347', cursor: 'pointer', padding: 0, fontFamily: '"Comic Sans MS", cursive', fontSize: '13px' }}>
          Handoffs
        </button>
        <span>›</span>
        <span style={{ color: '#8EB69B' }}>#{handoff.id.slice(0, 8)}</span>
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <HandoffMeta handoff={handoff} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {handoff.brief_body?.confidence && <ConfidenceBadge confidence={handoff.brief_body.confidence} />}
          <StatusBadge status={handoff.status} />
        </div>
      </div>

      {/* Awaiting review banner */}
      {handoff.status === 'awaiting_review' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', color: '#FFD166', fontSize: '13px' }}>
          <div style={{ width: '14px', height: '14px', border: '2px solid #FFD166', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          Brief generating... page will update automatically.
        </div>
      )}

      {/* Brief sections */}
      {handoff.brief_body ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <BriefSection title="What Changed"    icon="code"  content={handoff.brief_body.what_changed} />
          <BriefSection title="What Failed"     icon="alert" content={handoff.brief_body.what_failed} />
          <BriefSection title="Decisions Made"  icon="bulb"  content={handoff.brief_body.decisions_made} />
          <BriefSection title="Next Steps"      icon="arrow" content={handoff.brief_body.next_steps} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px', color: '#235347', fontSize: '14px' }}>
          Brief not yet generated.
        </div>
      )}

      {/* Back button */}
      <div style={{ marginTop: '32px' }}>
        <button
          onClick={() => navigate('/handoffs')}
          style={{ background: 'none', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '8px', color: '#8EB69B', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: '"Comic Sans MS", cursive', transition: 'border-color 150ms ease' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#00F5D4'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(142,182,155,0.15)'}
        >
          &larr; Back to Handoffs
        </button>
      </div>
    </div>
  )
}