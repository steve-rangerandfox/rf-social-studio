import React, { useEffect, useRef, useState } from "react";
import { Close as X, Upload } from "../../../components/icons/index.jsx";
import {
  T,
  formatRelativeStamp,
  uid,
} from "../shared.js";
import { uploadAssetWithProgress, checkFileSize } from "../../../lib/supabase.js";

export function AssetLibrary({ onClose, onSelect }) {
  const [assets, setAssets] = useState([
    {id:uid(),name:"RF Logo White",emoji:"RF",url:null,type:"image",favorite:true,addedAt:new Date().toISOString()},
    {id:uid(),name:"Mint BG Texture",emoji:"BG",url:null,type:"image",favorite:false,addedAt:new Date(Date.now()-86400000).toISOString()},
    {id:uid(),name:"Studio B-Roll",emoji:"VID",url:null,type:"video",favorite:true,addedAt:new Date(Date.now()-172800000).toISOString()},
    {id:uid(),name:"Team Photo",emoji:"CAM",url:null,type:"image",favorite:false,addedAt:new Date(Date.now()-259200000).toISOString()},
  ]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [activeUploads, setActiveUploads] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const fRef = useRef(null);

  useEffect(() => {
    if (!selectedId && assets[0]?.id) {
      setSelectedId(assets[0].id);
    }
  }, [assets, selectedId]);

  const upload = (files) => {
    Array.from(files).forEach(async (f) => {
      try {
        checkFileSize(f);
      } catch (err) {
        setUploadError(err.message);
        return;
      }
      const id = uid();
      const previewUrl = URL.createObjectURL(f);
      const isVideo = f.type.startsWith("video/");
      setUploadError("");
      setActiveUploads((prev) => [...prev, { id, name: f.name, progress: 0 }]);
      setAssets((current) => [
        {
          id,
          name: f.name,
          type: isVideo ? "video" : "image",
          url: previewUrl,
          emoji: isVideo ? "VID" : "IMG",
          favorite: false,
          addedAt: new Date().toISOString(),
          _uploading: true,
        },
        ...current,
      ]);
      setSelectedId(id);

      try {
        const publicUrl = await uploadAssetWithProgress(f, (p) => {
          setActiveUploads((prev) => prev.map((u) => u.id === id ? { ...u, progress: p } : u));
        });
        setAssets((current) => current.map((a) => a.id === id ? { ...a, url: publicUrl, _uploading: false } : a));
        URL.revokeObjectURL(previewUrl);
        setActiveUploads((prev) => prev.filter((u) => u.id !== id));
      } catch (err) {
        setUploadError(err?.message || "Upload failed");
        setAssets((current) => current.filter((a) => a.id !== id));
        URL.revokeObjectURL(previewUrl);
        setActiveUploads((prev) => prev.filter((u) => u.id !== id));
      }
    });
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesQuery = !query.trim() || asset.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "favorites" && asset.favorite) ||
      (filter === "recent" && Date.now() - new Date(asset.addedAt).getTime() < 7 * 86400000) ||
      asset.type === filter;

    return matchesQuery && matchesFilter;
  });
  const selectedAsset = assets.find((asset) => asset.id === selectedId) || filteredAssets[0] || assets[0] || null;

  const toggleFavorite = (id) => {
    setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, favorite: !asset.favorite } : asset));
  };

  return (
    <div className="asset-drawer">
      <div className="asset-head">
        <div>
          <div className="asset-title">Asset Library</div>
          <div className="asset-head-sub">{assets.length} assets ready for planning and story design</div>
        </div>
        <button className="m-x" onClick={onClose}><X size={14}/></button>
      </div>
      <div className="asset-body">
        <div className="asset-toolbar">
          <input
            className="asset-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets"
          />
          <div className="asset-tabs">
            {[
              ["all", "All"],
              ["image", "Images"],
              ["video", "Video"],
              ["favorites", "Favorites"],
              ["recent", "Recent"],
            ].map(([key, label]) => (
              <button key={key} className={`asset-tab ${filter === key ? "on" : ""}`} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="asset-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files);}} onClick={()=>fRef.current?.click()}>
          <input ref={fRef} type="file" accept="image/*,video/*,image/gif" multiple style={{display:"none"}} onChange={e=>upload(e.target.files)}/>
          <div style={{opacity:0.55,marginBottom:6}}><Upload size={20}/></div>
          <div style={{fontSize:13,color:T.textSub,fontWeight:500}}>Upload brand assets</div>
          <div style={{fontSize:12,color:T.textDim,marginTop:4}}>Images up to 25 MB · Videos up to 100 MB</div>
        </div>

        {activeUploads.length > 0 && (
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10,padding:"8px 10px",background:"#fafafa",border:"1px solid #e4e4e7",borderRadius:8}}>
            {activeUploads.map((u) => (
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,fontSize:13,color:"#09090b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                <div style={{flex:1,height:4,background:"#e4e4e7",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.round(u.progress*100)}%`,background:"#09090b",transition:"width 140ms ease"}}/>
                </div>
                <div style={{fontSize:12,color:"#71717a",fontVariantNumeric:"tabular-nums",width:34,textAlign:"right"}}>{Math.round(u.progress*100)}%</div>
              </div>
            ))}
          </div>
        )}
        {uploadError && (
          <div style={{marginTop:10,padding:"8px 10px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:"#dc2626"}}>
            {uploadError}
          </div>
        )}

        {selectedAsset && (
          <div className="asset-focus">
            <div className="asset-focus-preview">
              {selectedAsset.url ? <img src={selectedAsset.url} className="asset-thumb" alt={selectedAsset.name}/> : <div className="asset-empty-thumb">{selectedAsset.emoji}</div>}
            </div>
            <div className="asset-focus-body">
              <div className="asset-focus-head">
                <div>
                  <div className="asset-focus-title">{selectedAsset.name}</div>
                  <div className="asset-focus-meta">{selectedAsset.type} • {formatRelativeStamp(selectedAsset.addedAt)}</div>
                </div>
                <button className={`asset-star ${selectedAsset.favorite ? "on" : ""}`} onClick={() => toggleFavorite(selectedAsset.id)}>
                  {selectedAsset.favorite ? "Saved" : "Save"}
                </button>
              </div>
              <button className="btn btn-primary" style={{alignSelf:"flex-start"}} onClick={() => onSelect?.(selectedAsset)}>
                Attach
              </button>
            </div>
          </div>
        )}

        <span className="s-lbl" style={{marginTop:4,display:"block"}}>Curated Assets</span>
        <div className="asset-grid">
          {filteredAssets.map((asset) => (
            <div key={asset.id} className={`asset-item ${selectedAsset?.id === asset.id ? "on" : ""}`} onClick={() => setSelectedId(asset.id)} title={asset.name}>
              {asset.url ? <img src={asset.url} className="asset-thumb" alt={asset.name}/> : <div className="asset-empty-thumb">{asset.emoji}</div>}
              <button className={`asset-fav ${asset.favorite ? "on" : ""}`} onClick={(event) => { event.stopPropagation(); toggleFavorite(asset.id); }}>
                {asset.favorite ? "\u2605" : "\u2606"}
              </button>
              <div className="asset-name">
                <span>{asset.name}</span>
                <span>{asset.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
