import React, { useEffect, useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import {
  T,
  formatRelativeStamp,
  uid,
} from "../shared.js";

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
  const fRef = useRef(null);

  useEffect(() => {
    if (!selectedId && assets[0]?.id) {
      setSelectedId(assets[0].id);
    }
  }, [assets, selectedId]);

  const upload = (files) => Array.from(files).forEach(f => {
    const id = uid();
    const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    setAssets((current) => [
      {
        id,
        name: f.name,
        type: f.type.startsWith("image/") ? "image" : "video",
        url,
        emoji: f.type.startsWith("image/") ? "IMG" : "VID",
        favorite: false,
        addedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setSelectedId(id);
  });

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
          <div style={{opacity:0.4,marginBottom:6}}><Upload size={20}/></div><div style={{fontSize:12,color:T.textSub}}>Upload brand assets</div>
          <div style={{fontSize:10,color:T.textDim,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>Images · Videos · GIFs</div>
        </div>

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
