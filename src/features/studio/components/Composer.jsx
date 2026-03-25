import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, Upload, Check } from "lucide-react";
import { T, PLATFORMS, toPTDisplay } from "../shared.js";
import { generateCaption } from "../../../lib/api-client.js";
import { CaptionEditor } from "./CaptionEditor.jsx";
import { LinkedInPreview } from "./LinkedInPreview.jsx";

export function Composer({ row, onClose, onPosted, postNow }) {
  const publishApiUrl = import.meta.env.VITE_PUBLISH_API_URL || "";
  const [plat,    setPlat]    = useState(row?.platform==="ig_story"?"ig_post":row?.platform||"ig_post");
  const [caption, setCaption] = useState(row?.caption||"");
  const [files,   setFiles]   = useState([]);
  const [fileUrls,setFileUrls]= useState([]);
  const [drag,    setDrag]    = useState(false);
  const [st,      setSt]      = useState(postNow?"posting":"idle");
  const [errMsg,  setErrMsg]  = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const fRef = useRef(null);
  const p = PLATFORMS[plat];
  const isLI = plat === "linkedin";
  const maxFiles = isLI ? 9 : 1;

  const schedDisp = row?.scheduledAt ? toPTDisplay(row.scheduledAt) : null;

  const addFiles = (newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    const incoming = Array.from(newFiles);
    if (!isLI) {
      // Single file for IG
      const f = incoming[0];
      setFiles([f]);
      setFileUrls(f.type.startsWith("image/") ? [URL.createObjectURL(f)] : []);
      return;
    }
    const remaining = maxFiles - files.length;
    const toAdd = incoming.slice(0, remaining);
    setFiles(prev => [...prev, ...toAdd]);
    setFileUrls(prev => [...prev, ...toAdd.filter(f => f.type.startsWith("image/")).map(f => URL.createObjectURL(f))]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setFileUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const doPost = useCallback(async () => {
    setSt("posting"); setErrMsg("");
    try {
      if (!publishApiUrl) {
        throw new Error("Publishing is not configured yet. Add VITE_PUBLISH_API_URL when the server-side publish endpoint is ready.");
      }
      const res = await fetch(publishApiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:plat,caption,mediaUrls:fileUrls})});
      const data = await res.json();
      if(!data.success) throw new Error(data.error||"Unknown error");
      setSt("done"); onPosted?.();
    } catch(err){ setSt("error"); setErrMsg(err.message); }
  }, [caption, fileUrls, onPosted, plat, publishApiUrl]);

  // If postNow, fire immediately on mount
  useEffect(() => { if(postNow) doPost(); }, [doPost, postNow]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="m-head">
          <div>
            <div className="m-title">{st==="done"?<>Published <Check size={14} style={{display:"inline",verticalAlign:"middle"}}/></>:postNow?"Posting now...":"Compose & Publish"}</div>
            <div className="m-sub">{row?.note}{schedDisp?` · Scheduled ${schedDisp.month}/${schedDisp.day} at ${schedDisp.hour}:${schedDisp.minute} ${schedDisp.ampm} PT`:""}</div>
          </div>
          <button className="m-x" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="m-body">
          {!postNow && <>
            <div className="field">
              <div className="lbl">Platform</div>
              <div className="plat-tabs">
                {Object.entries(PLATFORMS).filter(([k])=>k!=="ig_story").map(([k,pl])=>(
                  <button key={k} className="plat-tab" style={plat===k?{background:pl.bg,borderColor:pl.color,color:pl.color}:{}} onClick={()=>setPlat(k)}>{pl.label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div className="lbl">Media{isLI && files.length > 0 ? ` (${files.length}/${maxFiles})` : ""}</div>
                {isLI && fileUrls.length > 0 && (
                  <button className="btn btn-ghost" style={{padding:"3px 10px",fontSize:11}} onClick={()=>setShowPreview(true)}>Preview</button>
                )}
              </div>
              {files.length > 0 ? (
                isLI ? (
                  <div className="media-grid">
                    {fileUrls.map((url, i) => (
                      <div key={i} className="media-grid-item">
                        <img src={url} alt="" />
                        <button className="media-rm" onClick={() => removeFile(i)}><X size={12}/></button>
                      </div>
                    ))}
                    {files.length < maxFiles && (
                      <div className="media-add-btn" onClick={() => fRef.current?.click()}>
                        <span>+</span>
                        <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>Add</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div><div className="fp"><span style={{fontSize:17}}>{files[0].type.startsWith("image")?"img":"vid"}</span><span className="fn">{files[0].name}</span><button className="frm" onClick={()=>{setFiles([]);setFileUrls([]);}}><X size={12}/></button></div>{fileUrls[0]&&<img src={fileUrls[0]} className="ip" alt=""/>}</div>
                )
              ) : (
                <div className={`upload ${drag?"drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}} onClick={()=>fRef.current?.click()}>
                  <input ref={fRef} type="file" accept="image/*,video/*,image/gif" multiple={isLI} onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
                  <div style={{fontSize:22,opacity:0.35,marginBottom:7}}><Upload size={22}/></div>
                  <div style={{fontSize:13,color:T.textSub}}>Drop {isLI ? "files" : "file"} or click to browse</div>
                  <div style={{fontSize:11,color:T.textDim,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>{isLI ? "Up to 9 images · JPG · PNG" : "JPG · PNG · GIF · MP4 · MOV"}</div>
                </div>
              )}
            </div>
            <CaptionEditor value={caption} onChange={setCaption} platform={plat} note={row?.note}/>
          </>}
          {postNow && st==="posting" && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"32px 0"}}>
              <div className="pd" style={{width:12,height:12}}/>
              <div style={{fontSize:14,color:T.textSub}}>Publishing to {p.label}...</div>
            </div>
          )}
        </div>
        <div className="m-foot">
          {st==="posting"&&!postNow&&<div className="pr"><div className="pd"/><span className="pt">Publishing to {p.label}...</span></div>}
          {st==="done"&&<div className="sr"><div className="si"><Check size={12}/></div><span className="st2">Live on {p.label}</span></div>}
          {st==="error"&&<span className="er2"><X size={12} style={{display:"inline",verticalAlign:"middle"}}/> {errMsg}</span>}
          {st!=="done"&&!postNow&&<button className="btn btn-ghost" onClick={onClose}>Cancel</button>}
          {st==="done"?<button className="btn btn-ghost" onClick={onClose}>Close</button>
            :!postNow&&<button className="btn btn-primary" onClick={doPost} disabled={st==="posting"}>
              {st==="posting"?"Working...":"Publish Now"}
            </button>}
          {st==="error"&&<button className="btn btn-primary" onClick={doPost}>Retry</button>}
        </div>
      </div>
      {showPreview && <LinkedInPreview caption={caption} mediaUrls={fileUrls} onClose={()=>setShowPreview(false)} />}
    </div>
  );
}
