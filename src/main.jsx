import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGate } from './components/AuthGate.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { PrivacyPolicy } from './components/PrivacyPolicy.jsx'
import { TermsOfService } from './components/TermsOfService.jsx'
import { DataDeletion } from './components/DataDeletion.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
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
    </BrowserRouter>
  </ErrorBoundary>
)
