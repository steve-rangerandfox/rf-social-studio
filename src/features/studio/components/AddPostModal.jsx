import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { PlatformIcon } from "./PlatformIcon.jsx";
import { PLATFORMS, nowPT } from "../shared.js";

export function AddPostModal({ initialDate, onClose, onCreate }) {
  const titleRef = useRef(null);
  const safeDate = initialDate || nowPT();
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("ig_post");
  const [dateValue, setDateValue] = useState(() => {
    const y = safeDate.getFullYear();
    const m = String(safeDate.getMonth() + 1).padStart(2, "0");
    const d = String(safeDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [timeValue, setTimeValue] = useState("09:00");

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const canCreate = title.trim() && dateValue && timeValue;
  const previewDate = dateValue && timeValue ? new Date(`${dateValue}T${timeValue}:00`) : null;
  const platMeta = PLATFORMS[platform];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canCreate) return;
    onCreate({
      title: title.trim(),
      dateValue,
      timeValue,
      platform,
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal add-post-modal" onClick={(event) => event.stopPropagation()}>
        <div className="m-head">
          <div>
            <div className="m-title">Add post</div>
            <div className="m-sub">Give the draft a title, then choose when it should land on the calendar.</div>
          </div>
          <button className="m-x" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="m-body">
            <div className="field">
              <div className="lbl">Channel</div>
              <div style={{display:"flex",gap:8}}>
                {Object.entries(PLATFORMS).map(([key, pl]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={()=>setPlatform(key)}
                    title={pl.label}
                    style={{
                      display:"flex",alignItems:"center",justifyContent:"center",
                      width:40,height:40,borderRadius:10,border:"2px solid",cursor:"pointer",
                      borderColor: platform===key ? pl.color : "transparent",
                      background: platform===key ? pl.bg : "rgba(0,0,0,0.03)",
                      opacity: platform===key ? 1 : 0.45,
                      transition:"all .15s",
                    }}
                  >
                    <PlatformIcon platform={key} size={22}/>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="lbl">Title</div>
              <input
                ref={titleRef}
                className="inp"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Monthly metrics + studio recap"
              />
            </div>
            <div className="add-post-row">
              <div className="field">
                <div className="lbl">Date</div>
                <input className="inp" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
              </div>
              <div className="field">
                <div className="lbl">Time PT</div>
                <input className="inp" type="time" value={timeValue} onChange={(event) => setTimeValue(event.target.value)} />
              </div>
            </div>
            <div className="add-post-preview">
              <div>
                <div className="add-post-preview-title">{title.trim() || "Untitled post"}</div>
                <div className="add-post-preview-meta">
                  {previewDate
                    ? `${previewDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} \u00B7 ${timeValue} PT`
                    : "Choose a date and time"}
                </div>
              </div>
            </div>
          </div>
          <div className="m-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!canCreate}>Create post</button>
          </div>
        </form>
      </div>
    </div>
  );
}
