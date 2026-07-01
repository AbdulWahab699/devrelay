import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import HandoffListPage from './pages/HandoffListPage'
import HandoffDetailPage from './pages/HandoffDetailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AppShell from './components/layout/AppShell'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <ProtectedRoute><OnboardingPage /></ProtectedRoute> },
  {
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { path: '/', element: <HandoffListPage /> },
      { path: '/handoffs', element: <HandoffListPage /> },
      { path: '/handoffs/:id', element: <HandoffDetailPage /> },
      { path: '/analytics', element: <AnalyticsPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
