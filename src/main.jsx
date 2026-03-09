import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignIn, ClerkLoaded, RedirectToSignIn, useAuth } from '@clerk/react'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) return (
    <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#F7F8FA'}}>
      <SignIn />
    </div>
  )
  return <App />
}

createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <AuthGate />
  </ClerkProvider>
)