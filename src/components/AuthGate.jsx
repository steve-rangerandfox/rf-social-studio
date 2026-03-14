import { SignIn, useAuth } from "@clerk/react";

import App from "../App.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

export function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F8FA",
        }}
      >
        <SignIn />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
