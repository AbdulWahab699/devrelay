import { Outlet } from 'react-router-dom'

export default function AppShell() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ width: 240, background: 'var(--nav-bg)' }} />
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
