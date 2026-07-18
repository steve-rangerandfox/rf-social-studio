// Deterministic Clerk stand-in for the browser harness ONLY.
//
// The real studio surfaces sit behind Clerk auth — StudioContext calls
// useAuth()/useUser() at mount. vite.harness.config.js aliases "@clerk/react"
// to this module so those surfaces mount as a signed-in user with no network
// and no live credentials. Within the harness-loaded tree, StudioContext is the
// only Clerk consumer (useAuth + useUser); ClerkProvider/SignIn live in
// main.jsx/AuthGate, which the harness never loads — so this module exports
// only hooks (no components), keeping it clean under the repo's lint contract.
//
// getToken() returns null on purpose: the studio's persistence layer then runs
// its unauthenticated path (fetches fail and fall back to local state), which
// is exactly the "does the shell survive a degraded backend" condition tested.

const HARNESS_USER_ID = "user_harness_0000000000000000";

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: HARNESS_USER_ID,
    sessionId: "sess_harness",
    orgId: null,
    getToken: async () => null,
    signOut: async () => {},
  };
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: HARNESS_USER_ID,
      fullName: "Harness User",
      primaryEmailAddress: { emailAddress: "harness@example.test" },
      emailAddresses: [{ emailAddress: "harness@example.test" }],
      imageUrl: "",
    },
  };
}

export function useClerk() {
  return { signOut: async () => {}, openSignIn: () => {} };
}
