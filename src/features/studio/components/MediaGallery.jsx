import React, { useState } from "react";
import { Close as X, Plus } from "../../../components/icons/index.jsx";

// Native multi-image gallery for a post (no designer needed): big preview of
// the active item, thumbnail strip below — click to view, drag to reorder,
// × to remove, + to add. Items: { id, url, publicUrl, uploading, isVideo }.

export function MediaGallery({ items, activeIdx, onSelect, onReorder, onRemove, onAdd, compact }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const active = items[Math.min(activeIdx, items.length - 1)] || items[0];

  const drop = (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    onReorder(next, next.indexOf(active));
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className={"mg" + (compact ? " compact" : "")}>
      <div className="mg-main">
        {active?.isVideo
          ? <video src={active.url} muted loop playsInline autoPlay controls />
          : <img src={active?.url} alt="" />}
        {active?.uploading && <span className="mg-uploading">Uploading…</span>}
      </div>
      <div className="mg-strip" role="listbox" aria-label="Post media — click to view, drag to reorder">
        {items.map((it, i) => (
          <div
            key={it.id}
            role="option"
            aria-selected={i === activeIdx}
            className={"mg-thumb" + (i === activeIdx ? " on" : "") + (overIdx === i && dragIdx !== null && dragIdx !== i ? " over" : "")}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            onDrop={(e) => { e.preventDefault(); drop(i); }}
            onClick={() => onSelect(i)}
          >
            {it.isVideo ? <video src={it.url} muted playsInline /> : <img src={it.url} alt="" />}
            <span className="mg-thumb-n">{i + 1}</span>
            {it.uploading && <span className="mg-thumb-up" />}
            <button type="button" className="mg-thumb-rm" onClick={(e) => { e.stopPropagation(); onRemove(i); }} aria-label={`Remove item ${i + 1}`}>
              <X size={8} />
            </button>
          </div>
        ))}
        {onAdd && (
          <button type="button" className="mg-add" onClick={onAdd} title="Add images" aria-label="Add images">
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
