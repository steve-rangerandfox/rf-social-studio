import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { AuthGate } from './components/AuthGate.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  </ClerkProvider>
)
