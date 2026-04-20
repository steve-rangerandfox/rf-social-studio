import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { LoadingShell } from './components/LoadingShell.jsx'
import { ToasterProvider } from './components/Toaster.jsx'
import {
  About,
  AuthGate,
  DataDeletion,
  Landing,
  NotFound,
  Pricing,
  PrivacyPolicy,
  TermsOfService,
} from './routes.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// When a lazy-loaded chunk 404s (typically because a fresh deploy
// invalidated the hash the user's cached index.html references), Vite
// emits `vite:preloadError`. The default behaviour is to throw into
// the nearest ErrorBoundary, which manifests as a blank screen. Reload
// the page once so the browser picks up the current index.html + the
// matching chunks. A session flag prevents an infinite loop if the
// reload itself fails the same way.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    const key = "rf_preload_reloaded_at";
    const lastReload = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - lastReload > 10_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ToasterProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingShell />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/app/*" element={
              <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
                <AuthGate />
              </ClerkProvider>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToasterProvider>
  </ErrorBoundary>
)
