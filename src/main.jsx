import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { LoadingShell } from './components/LoadingShell.jsx'
import {
  AuthGate,
  PrivacyPolicy,
  TermsOfService,
  DataDeletion,
} from './routes.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<LoadingShell />}>
        <Routes>
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/*" element={
            <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
              <AuthGate />
            </ClerkProvider>
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </ErrorBoundary>
)
