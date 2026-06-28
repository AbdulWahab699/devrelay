import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: '"Comic Sans MS", cursive', textAlign: 'center', background: '#051F20' }}>
      <div style={{ fontSize: '72px', fontWeight: 700, color: '#163832', marginBottom: '8px' }}>404</div>
      <div style={{ fontSize: '18px', fontWeight: 600, color: '#8EB69B', marginBottom: '8px' }}>Page not found</div>
      <div style={{ fontSize: '13px', color: '#235347', marginBottom: '32px' }}>The page you're looking for doesn't exist.</div>
      <button
        onClick={() => navigate('/handoffs')}
        style={{ background: 'rgba(0,245,212,0.1)', border: '1px solid #00F5D4', borderRadius: '8px', color: '#00F5D4', fontSize: '13px', padding: '10px 24px', cursor: 'pointer', fontFamily: '"Comic Sans MS", cursive' }}
      >
        Back to Handoffs
      </button>
    </div>
  )
}