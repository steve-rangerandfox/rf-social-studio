/* eslint-disable react-refresh/only-export-components */
// DEV-ONLY harness: mounts the real CanvasElement in StoryDesigner's exact
// wiring (outside pointerdown clears editingId + selection) to reproduce the
// "text edit reverts on click-out" bug in isolation. Served only by the Vite
// dev server via /dev-harness.html — not part of any prod build input.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CanvasElement } from "../features/studio/components/CanvasElement.jsx";
import "../features/studio/studio.css";

function Harness() {
  const [elements, setElements] = useState([
    { id: "t1", type: "text", content: "Heading", x: 40, y: 60, fontSize: 32, color: "#ff2fa0", fontFamily: "Arial", fontWeight: 700 },
  ]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  // Mimic StudioApp render churn: every element update bumps a counter
  // (like the auto-save effect writing to the row) so re-renders happen
  // mid-edit exactly as in the real app.
  const [churn, setChurn] = useState(0);

  const updateEl = (id, patch) => {
    setElements((els) => els.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setChurn((c) => c + 1);
  };

  const el = elements[0];
  return (
    <div style={{ padding: 24 }}>
      <div
        data-testid="canvas-row"
        role="img"
        aria-label="canvas background"
        onPointerDown={(e) => {
          // StoryDesigner's sd-canvas-row handler: click outside deselects
          if (e.target === e.currentTarget) { setSelectedIds(new Set()); setEditingId(null); }
        }}
        style={{ position: "relative", width: 400, height: 400, background: "#333", overflow: "hidden" }}
      >
        <CanvasElement
          data={el}
          isSelected={selectedIds.has(el.id)}
          onSelect={() => setSelectedIds(new Set([el.id]))}
          onUpdate={(p) => updateEl(el.id, p)}
          isEditing={editingId === el.id}
          onStartEdit={() => { setSelectedIds(new Set([el.id])); setEditingId(el.id); }}
          onStopEdit={() => setEditingId(null)}
          siblings={elements}
          canvasW={400} canvasH={400}
        />
      </div>
      <div style={{ marginTop: 16, fontSize: 14 }}>
        <div id="committed">COMMITTED: [{el.content}]</div>
        <div id="editing-state">EDITING: {String(editingId)}</div>
        <div id="churn">CHURN: {churn}</div>
      </div>
      <button id="outside-btn" style={{ marginTop: 8 }}>outside button</button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
