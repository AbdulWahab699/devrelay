import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#051F20',
      fontFamily: '"Comic Sans MS", cursive',
    }}>
      <Sidebar />
      <main style={{
        flex: 1,
        overflow: 'auto',
        marginLeft: '72px',
      }}>
        <Outlet />
      </main>
    </div>
  )
}
