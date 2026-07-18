// Harness entry: mounts the REAL studio shell (StudioApp default =
// StudioProvider + StudioShell) with the same providers main.jsx gives it
// (BrowserRouter for the router hooks, ToasterProvider for useToast). Clerk is
// aliased to the harness mock by vite.harness.config.js, so the shell mounts as
// a signed-in user with no network. This is the surface build/lint/unit tests
// cannot prove renders (CLAUDE.md: "build ... do not prove that a major React
// surface mounts successfully").
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToasterProvider } from "../src/components/Toaster.jsx";
import App from "../src/App.jsx";

// Diagnostic: surface async rejections to the spec alongside Playwright's
// native pageerror capture (which covers synchronous throws).
window.__HARNESS_ERRORS__ = [];
window.addEventListener("unhandledrejection", (e) => {
  window.__HARNESS_ERRORS__.push(String(e.reason && e.reason.message ? e.reason.message : e.reason));
});

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ToasterProvider>
      <App />
    </ToasterProvider>
  </BrowserRouter>,
);
