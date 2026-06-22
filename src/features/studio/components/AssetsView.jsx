import React, { useEffect, useRef, useState } from "react";
import { useStudio } from "../StudioContext.jsx";
import {
  uploadAssetWithProgress,
  checkFileSize,
  fetchAssets,
  saveAsset,
} from "../../../lib/supabase.js";

// Assets — full-view library backed by the Supabase media_assets table
// (the same store the AssetLibrary side panel uploads into). The prototype
// kept assets in localStorage as data URLs; here they persist server-side
// with public URLs, so nothing is duplicated and storage stays sane.

function fmtBytes(n) {
  if (!n) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

export function AssetsView() {
  const { showToast } = useStudio();
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState("all"); // all | image | video
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchAssets()
      .then((rows) => { if (!cancelled) setAssets(rows || []); })
      .catch(() => { /* unconfigured / offline — start empty */ });
    return () => { cancelled = true; };
  }, []);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    for (const f of files) {
      try { checkFileSize(f); } catch (err) { showToast(err.message); continue; }
      const tmpId = "u-" + Math.random().toString(36).slice(2, 8);
      const type = f.type.startsWith("video/") ? "video" : "image";
      setUploads((u) => [...u, { id: tmpId, name: f.name, progress: 0 }]);
      try {
        const url = await uploadAssetWithProgress(f, (p) =>
          setUploads((u) => u.map((x) => (x.id === tmpId ? { ...x, progress: p } : x))),
        );
        let saved;
        try {
          saved = await saveAsset({ name: f.name, url, type, size_bytes: f.size });
        } catch {
          // Storage upload worked but metadata insert failed — still show it.
          saved = { id: tmpId, name: f.name, url, type, size_bytes: f.size, created_at: new Date().toISOString() };
        }
        setAssets((a) => [saved, ...a]);
        showToast(`${f.name} uploaded.`);
      } catch (err) {
        showToast(err?.message || "Upload failed");
      } finally {
        setUploads((u) => u.filter((x) => x.id !== tmpId));
      }
    }
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); };

  const visible = assets.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (query && !(a.name || "").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const imageCount = assets.filter((a) => a.type === "image").length;
  const videoCount = assets.filter((a) => a.type === "video").length;
  const totalBytes = assets.reduce((s, a) => s + (a.size_bytes || 0), 0);

  return (
    <div className="av-wrap">
      <div className="av-head">
        <div>
          <div className="av-kicker">studio / assets</div>
          <h1 className="av-title">Assets</h1>
          <p className="av-lede">Everything the studio has uploaded — images and video, ready to drop into a post.</p>
        </div>
        <div className="av-stats">
          <div><div className="av-stat-n">{imageCount}</div><div className="av-stat-l">Images</div></div>
          <div><div className="av-stat-n">{videoCount}</div><div className="av-stat-l">Videos</div></div>
          <div><div className="av-stat-n">{fmtBytes(totalBytes)}</div><div className="av-stat-l">On disk</div></div>
        </div>
      </div>

      <div className="av-toolbar">
        <div className="av-tabs">
          {[["all", "All"], ["image", "Images"], ["video", "Videos"]].map(([k, l]) => (
            <button key={k} className={"av-tab " + (filter === k ? "on" : "")} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input className="av-search" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => inputRef.current?.click()}>+ Upload</button>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {uploads.length > 0 && (
        <div className="av-uploads">
          {uploads.map((u) => (
            <div key={u.id} className="av-upload-row">
              <span className="av-upload-name">{u.name}</span>
              <div className="av-upload-bar"><div style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>
              <span className="av-upload-pct">{Math.round(u.progress * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      <div
        className={"av-grid " + (dragOver ? "drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {visible.length === 0 && (
          <div className="av-empty">
            <div className="av-empty-mark">{"↓"}</div>
            <div className="av-empty-t">Drop files to upload</div>
            <div className="av-empty-s">Or <button className="linkbtn" onClick={() => inputRef.current?.click()}>browse</button> — images up to 25 MB, video up to 100 MB.</div>
          </div>
        )}

        {visible.map((a) => (
          <div key={a.id} className="av-card">
            <div className="av-media">
              {a.type === "image"
                ? <img src={a.url} alt={a.name} />
                : <video src={a.url} muted loop playsInline onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />}
              <div className="av-kind">{a.type}</div>
            </div>
            <div className="av-meta">
              <div className="av-name" title={a.name}>{a.name}</div>
              <div className="av-sub">{fmtBytes(a.size_bytes)} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
