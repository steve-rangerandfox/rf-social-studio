import React, { useState } from "react";
import { Close as X, ImageIcon } from "../../../components/icons/index.jsx";

// Buffer-style media tile row for a post: one row of large tiles — click
// to expand, hover for edit/remove, drag to reorder, dashed tile to add.
// No big active preview. Items: { id, url, uploading, isVideo }.

export function MediaGallery({ items, onReorder, onRemove, onAdd, onOpen, onEdit }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const drop = (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    onReorder(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="cpm-tiles mg-row" role="listbox" aria-label="Post media — click to expand, drag to reorder">
      {items.map((it, i) => (
        <div
          key={it.id}
          role="option"
          aria-selected={false}
          className={"cpm-tile" + (overIdx === i && dragIdx !== null && dragIdx !== i ? " mg-over" : "")}
          title="Click to expand"
          draggable
          onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("application/x-mg-reorder", "1"); e.dataTransfer.effectAllowed = "move"; setDragIdx(i); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOverIdx(i); }}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(i); }}
          onClick={() => onOpen?.(it)}
        >
          {it.isVideo ? <video src={it.url} muted playsInline /> : <img src={it.url} alt="" />}
          <span className="mg-thumb-n">{i + 1}</span>
          {it.uploading && <span className="mg-thumb-up" />}
          <button type="button" className="cpm-media-rm" onClick={(e) => { e.stopPropagation(); onRemove(i); }} aria-label={`Remove item ${i + 1}`}>
            <X size={9} />
          </button>
          {onEdit && !it.isVideo && !it.uploading && (
            <button type="button" className="cpm-tile-ctl cpm-tile-edit" title="Edit image"
              onClick={(e) => { e.stopPropagation(); onEdit(i); }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M11.3 2.2 13.8 4.7 5.5 13H3v-2.5L11.3 2.2Z"/><path d="M9.8 3.7l2.5 2.5"/></svg>
            </button>
          )}
        </div>
      ))}
      {onAdd && (
        <button type="button" className="cpm-tile cpm-tile-add" onClick={onAdd} title="Add images" aria-label="Add images">
          <ImageIcon size={17} />
          <span>Drag &amp; drop or <em>select a file</em></span>
        </button>
      )}
    </div>
  );
}
