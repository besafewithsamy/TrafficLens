import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { CapturePage } from './pages/CapturePage'
import { FlowsPage } from './pages/FlowsPage'
import { HostsPage } from './pages/HostsPage'
import { ProtocolPage } from './pages/ProtocolPage'
import { AlertsPage } from './pages/AlertsPage'
import { GraphPage } from './pages/GraphPage'
import { TimelinePage } from './pages/TimelinePage'
import { ReplayPage } from './pages/ReplayPage'
import { EngineerPage } from './pages/EngineerPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/capture', element: <CapturePage /> },
      { path: '/flows', element: <FlowsPage /> },
      { path: '/hosts', element: <HostsPage /> },
      { path: '/protocol', element: <ProtocolPage /> },
      { path: '/alerts', element: <AlertsPage /> },
      { path: '/timeline', element: <TimelinePage /> },
      { path: '/graph', element: <GraphPage /> },
      { path: '/replay', element: <ReplayPage /> },
      { path: '/engineer', element: <EngineerPage /> },
      { path: '*', element: <Dashboard /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
