import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'

interface SlackStatus { connected: boolean; workspaceName?: string }
interface TeamSettings { receiver_slack_id: string | null }

export default function SettingsPage() {
  const qc = useQueryClient()
  const [receiver, setReceiver] = useState('')
  const [saved, setSaved] = useState(false)

  const { data: slack } = useQuery<SlackStatus>({
    queryKey: ['slack-status'],
    queryFn: () => apiRequest<SlackStatus>('/slack/status'),
  })

  const { data: team } = useQuery<TeamSettings>({
    queryKey: ['team-settings'],
    queryFn: () => apiRequest<TeamSettings>('/teams/current'),
  })

  const saveMutation = useMutation({
    mutationFn: () => apiRequest('/teams/current', { method: 'PUT', body: JSON.stringify({ receiverSlackId: receiver }) }),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ['team-settings'] }); setTimeout(() => setSaved(false), 2000) },
  })

  const sectionStyle = { background: 'rgba(11,43,38,0.65)', backdropFilter: 'blur(12px)' as const, border: '1px solid rgba(142,182,155,0.15)', borderRadius: '10px', padding: '24px', marginBottom: '16px' }
  const labelStyle = { fontSize: '12px', color: '#235347', letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '16px', fontWeight: 600 }
  const inputStyle = { background: '#163832', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '8px', color: '#E2F1E7', fontSize: '13px', padding: '10px 14px', fontFamily: '"Comic Sans MS", cursive', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const btnStyle = (accent?: boolean) => ({ background: accent ? 'rgba(0,245,212,0.1)' : 'none', border: '1px solid ' + (accent ? '#00F5D4' : 'rgba(142,182,155,0.15)'), borderRadius: '8px', color: accent ? '#00F5D4' : '#8EB69B', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: '"Comic Sans MS", cursive' })

  return (
    <div style={{ padding: '32px', maxWidth: '700px', margin: '0 auto', fontFamily: '"Comic Sans MS", cursive' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#E2F1E7', marginBottom: '32px', letterSpacing: '-0.02em' }}>Settings</h1>

      {/* Slack Integration */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Slack Integration</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#E2F1E7', marginBottom: '4px' }}>
              {slack?.connected ? slack.workspaceName ?? 'Connected' : 'Not connected'}
            </div>
            <div style={{ fontSize: '12px', color: '#235347' }}>
              {slack?.connected ? 'Slack is connected and ready to deliver briefs.' : 'Connect Slack to deliver handoff briefs via DM.'}
            </div>
          </div>
          {slack?.connected ? (
            <button style={btnStyle()} onClick={() => apiRequest('/slack/disconnect', { method: 'POST' })}>Disconnect</button>
          ) : (
            <a href={`https://slack.com/oauth/v2/authorize?client_id=${import.meta.env.VITE_SLACK_CLIENT_ID}&scope=chat:write,users:read&redirect_uri=${encodeURIComponent(window.location.origin + '/slack/callback')}`}
              style={{ ...btnStyle(true), textDecoration: 'none', display: 'inline-block' }}>
              Add to Slack
            </a>
          )}
        </div>
      </div>

      {/* Receiver Config */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Receiver Configuration</div>
        <div style={{ fontSize: '12px', color: '#235347', marginBottom: '12px' }}>
          Current: {team?.receiver_slack_id ?? 'Not set'}
        </div>
        <input
          style={inputStyle}
          placeholder="@slack-handle"
          value={receiver}
          onChange={e => setReceiver(e.target.value)}
        />
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button style={btnStyle(true)} onClick={() => saveMutation.mutate()}>Save</button>
          {saved && <span style={{ fontSize: '12px', color: '#3CD070' }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  )
}