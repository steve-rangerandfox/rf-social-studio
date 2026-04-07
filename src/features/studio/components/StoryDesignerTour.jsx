import React, { useState } from "react";
import { X, ChevronRight } from "lucide-react";

const DISMISS_KEY = "rf_story_designer_tour_dismissed";

const TOUR_STEPS = [
  {
    title: "Drag elements to add",
    body: "Drag a text box, image, or video from the toolbar onto the canvas. Or click an item to add it at the center.",
    targetHint: "Look at the toolbar on the left",
  },
  {
    title: "Click to edit",
    body: "Click any element on the canvas to select it. Double-click text to edit it directly. Drag the corner handles to resize, the top handle to rotate.",
    targetHint: "Try clicking anything on the canvas",
  },
  {
    title: "Style with the Inspector",
    body: "When an element is selected, the Inspector on the right shows controls for color, font, alignment, opacity, and filters. Sliders give live previews.",
    targetHint: "Look at the right panel",
  },
  {
    title: "Save when ready",
    body: "Your changes are saved automatically. Click Publish Story when you're ready to ship \u2014 or Download PNG to export. Press Escape to close the designer.",
    targetHint: "The save status is in the top corner",
  },
];

export function StoryDesignerTour() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ }
    setDismissed(true);
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <aside className="sd-tour" role="dialog" aria-label="Story Designer tour">
      <div className="sd-tour-header">
        <span className="sd-tour-step">{step + 1} / {TOUR_STEPS.length}</span>
        <button className="sd-tour-close" onClick={dismiss} aria-label="Skip tour">
          <X size={12} />
        </button>
      </div>
      <div className="sd-tour-title">{current.title}</div>
      <div className="sd-tour-body">{current.body}</div>
      {current.targetHint && (
        <div className="sd-tour-hint">{current.targetHint}</div>
      )}
      <div className="sd-tour-actions">
        <button className="sd-tour-skip" onClick={dismiss}>
          Skip
        </button>
        <button className="sd-tour-next" onClick={next}>
          {isLast ? "Got it" : "Next"} {!isLast && <ChevronRight size={12} />}
        </button>
      </div>
    </aside>
  );
}
