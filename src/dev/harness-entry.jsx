/* eslint-disable react-refresh/only-export-components, react-hooks/refs */
// DEV-ONLY harness: mounts the real CanvasElement in StoryDesigner's exact
// wiring (outside pointerdown clears editingId + selection) to reproduce the
// "text edit reverts on click-out" bug in isolation. Served only by the Vite
// dev server via /dev-harness.html — not part of any prod build input.
import { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { CanvasElement } from "../features/studio/components/CanvasElement.jsx";
import "../features/studio/studio.css";

function Harness() {
  const [elements, setElements] = useState([
    { id: "t1", type: "text", content: "Heading", x: 40, y: 40, fontSize: 32, color: "#ff2fa0", fontFamily: "Arial", fontWeight: 700 },
    { id: "t2", type: "text", content: "Static", x: 40, y: 220, fontSize: 32, color: "#3fd", fontFamily: "Arial", fontWeight: 700 },
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

  // StoryDesigner's exact handleSelect (shift toggles, plain replaces).
  const handleSelect = (id, shiftKey) => {
    if (shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  // StoryDesigner's multi-drag wiring (refs + onDragStart snapshot).
  const elementsRef = useRef(elements); elementsRef.current = elements;
  const selectedIdsRef = useRef(selectedIds); selectedIdsRef.current = selectedIds;
  const dragStartRef = useRef({});
  const initMultiDrag = () => {
    const starts = {};
    selectedIdsRef.current.forEach((id) => {
      const el = elementsRef.current.find((e) => e.id === id);
      if (el && !el.locked) starts[id] = { x: el.x, y: el.y };
    });
    dragStartRef.current = starts;
  };
  const multiDrag = (dx, dy) => {
    const starts = dragStartRef.current;
    setElements((els) => els.map((e) => (starts[e.id] ? { ...e, x: starts[e.id].x + dx, y: starts[e.id].y + dy } : e)));
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        data-testid="canvas-row"
        role="img"
        aria-label="canvas background"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) { setSelectedIds(new Set()); setEditingId(null); }
        }}
        style={{ position: "relative", width: 400, height: 400, background: "#333", overflow: "hidden" }}
      >
        {elements.map((el) => (
          <CanvasElement
            key={el.id}
            data={el}
            isSelected={selectedIds.has(el.id)}
            onSelect={(id, shiftKey) => handleSelect(el.id, shiftKey)}
            onDragStart={initMultiDrag}
            onDragAll={selectedIds.size > 1 && selectedIds.has(el.id) ? multiDrag : undefined}
            onUpdate={(p) => updateEl(el.id, p)}
            isEditing={editingId === el.id}
            onStartEdit={() => { setSelectedIds(new Set([el.id])); setEditingId(el.id); }}
            onStopEdit={() => setEditingId(null)}
            siblings={elements}
            canvasW={400} canvasH={400}
          />
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 14 }}>
        <div id="committed">COMMITTED: [{elements[0].content}]</div>
        <div id="editing-state">EDITING: {String(editingId)}</div>
        <div id="selected">SELECTED: [{[...selectedIds].join(",")}]</div>
        <div id="pos">POS t1: ({Math.round(elements[0].x)},{Math.round(elements[0].y)}) t2: ({Math.round(elements[1].x)},{Math.round(elements[1].y)})</div>
        <div id="churn">CHURN: {churn}</div>
      </div>
      <button id="outside-btn" style={{ marginTop: 8 }}>outside button</button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
