import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'

interface UserProfile {
  user: {
    id: string
    github_id: string
    email: string | null
    display_name: string | null
    avatar_url: string | null
    created_at: string
  }
}

export default function ProfilePage() {
  const { data, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => apiRequest<UserProfile>('/auth/me'),
  })

  const user = data?.user
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(142,182,155,0.08)' }

  return (
    <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Comic Sans MS", cursive' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#E2F1E7', marginBottom: '32px', letterSpacing: '-0.02em' }}>Profile</h1>

      <div style={{ background: 'rgba(11,43,38,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(142,182,155,0.15)', borderRadius: '10px', padding: '28px' }}>
        {isLoading ? (
          <div style={{ height: '80px', background: '#163832', borderRadius: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid rgba(142,182,155,0.2)' }} />
                : <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#163832', border: '2px solid rgba(142,182,155,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#8EB69B' }}>{user?.display_name?.[0]?.toUpperCase() ?? 'U'}</div>
              }
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#E2F1E7' }}>{user?.display_name ?? 'Unknown'}</div>
                <div style={{ fontSize: '13px', color: '#235347', marginTop: '2px' }}>{user?.email ?? 'No email'}</div>
              </div>
            </div>
            {[
              { label: 'GitHub ID', value: user?.github_id },
              { label: 'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
            ].map(row => (
              <div key={row.label} style={rowStyle}>
                <span style={{ fontSize: '13px', color: '#235347' }}>{row.label}</span>
                <span style={{ fontSize: '13px', color: '#8EB69B' }}>{row.value ?? '—'}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}