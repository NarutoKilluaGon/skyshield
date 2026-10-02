import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { routes } from '@/routes'
import { AuthProvider } from '@/lib/auth'
import { ErrorBoundary } from '@/lib/error-boundary'

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <ErrorBoundary scope="the application">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  )
}
