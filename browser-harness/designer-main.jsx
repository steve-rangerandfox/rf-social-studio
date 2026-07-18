// Harness entry: mounts the REAL StoryDesigner through its supported prop
// entrypoint ({ row, onClose, onUpdate }) inside the providers it needs
// (StudioProvider for useStudio()'s brandProfile; BrowserRouter + Toaster for
// the provider's own hooks). Clerk is aliased to the harness mock.
//
// The designer drives the browser mechanisms the mission cares about — inline
// contentEditable text commit, real pointer drag, and muted preview-video
// readiness — on a deterministic fixture row. onUpdate patches are recorded on
// window for diagnostics; the specs assert the rendered result.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToasterProvider } from "../src/components/Toaster.jsx";
import { StudioProvider } from "../src/features/studio/StudioContext.jsx";
import { StoryDesigner } from "../src/features/studio/components/StoryDesigner.jsx";
import { fixtureRow } from "./fixture-row.js";

window.__HARNESS_ERRORS__ = [];
window.addEventListener("unhandledrejection", (e) => {
  window.__HARNESS_ERRORS__.push(String(e.reason && e.reason.message ? e.reason.message : e.reason));
});
window.__DESIGNER_PATCHES__ = [];

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ToasterProvider>
      <StudioProvider>
        <StoryDesigner
          row={fixtureRow}
          onClose={() => {}}
          onUpdate={(patch) => window.__DESIGNER_PATCHES__.push(patch)}
        />
      </StudioProvider>
    </ToasterProvider>
  </BrowserRouter>,
);
