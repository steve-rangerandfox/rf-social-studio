import React, { useState } from "react";
import { generateCaption } from "../../../lib/api-client.js";
import { T } from "../shared.js";

export function AICaptionAssist({ platform, note, caption, onAccept, variant = "panel" }) {
  const isInline = variant === "inline";
  const [prompt, setPrompt] = useState(isInline ? (caption || note || "") : (note || ""));
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setResult("");

    // Inline variant adds tone guidance
    const finalPrompt = isInline
      ? (() => {
          const tone = platform === "linkedin"
            ? "professional, thought-leader tone. No emojis. Under 1200 chars."
            : "bold, studio-confident. Relevant hashtags. Under 300 chars.";
          return `${prompt}. ${tone}`;
        })()
      : prompt;

    try {
      const data = await generateCaption({ platform, prompt: finalPrompt });
      const text = data.caption || "";
      let i = 0;
      const step = isInline ? 4 : 3;
      const delay = isInline ? 16 : 18;
      const interval = setInterval(() => {
        i += step; setResult(text.slice(0, i));
        if (i >= text.length) { setResult(text); clearInterval(interval); setLoading(false); }
      }, delay);
    } catch(e) { setResult(e.message || (isInline ? "Couldn't reach AI." : "Couldn't connect to AI.")); setLoading(false); }
  };

  if (isInline) {
    return (
      <div className="stage-ai">
        <div className="stage-ai-header">
          <div className="stage-ai-title"><span>Caption assist</span></div>
          <button style={{background:"transparent",border:"none",color:T.textSub,fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}
            onClick={generate} disabled={loading}>{loading ? "Drafting\u2026" : "Generate"}</button>
        </div>
        <input style={{background:"rgba(255,255,255,0.72)",border:`1px solid ${T.border}`,borderRadius:10,fontSize:12,padding:"9px 11px",outline:"none",color:T.text,width:"100%"}}
          value={prompt} onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&generate()} placeholder="Describe the angle you want\u2026"/>
        {(result||loading) && (
          <div className={`stage-ai-result ${loading&&!result?"stage-ai-typing":""}`}>{result||" "}</div>
        )}
        {result && !loading && (
          <button style={{background:T.s3,border:`1px solid ${T.border2}`,borderRadius:999,padding:"7px 11px",fontSize:11,fontWeight:700,color:T.textSub,cursor:"pointer",alignSelf:"flex-end"}}
            onClick={() => onAccept(result)}>Use this \u2191</button>
        )}
      </div>
    );
  }

  // Panel variant (full AI Writer)
  return (
    <div className="ai-panel">
      <div className="ai-header"><span className="ai-title">AI Caption Writer</span></div>
      <div style={{display:"flex",gap:8}}>
        <input className="inp" style={{flex:1,fontSize:12.5}} value={prompt} onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&generate()} placeholder="Describe what you\u2019re posting\u2026"/>
        <button className="btn btn-ai" style={{padding:"7px 12px",fontSize:12,flexShrink:0}}
          onClick={generate} disabled={loading||!prompt.trim()}>{loading?"Writing\u2026":"Generate"}</button>
      </div>
      {(result||loading)&&<div className={`ai-result ${loading&&!result?"ai-typing":""}`}>{result||" "}</div>}
      {result&&!loading&&<div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="btn btn-ghost" style={{padding:"5px 11px",fontSize:12}} onClick={generate}>Regenerate</button>
        <button className="btn btn-ai" style={{padding:"5px 11px",fontSize:12}} onClick={()=>onAccept(result)}>Use this \u2191</button>
      </div>}
    </div>
  );
}
