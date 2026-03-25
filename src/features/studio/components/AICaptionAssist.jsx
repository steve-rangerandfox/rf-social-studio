import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { generateCaption } from "../../../lib/api-client.js";
import { T } from "../shared.js";

export function AICaptionAssist({ platform, note, caption, onAccept, variant = "panel" }) {
  const isInline = variant === "inline";
  const [prompt, setPrompt] = useState(note || "");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    const tone = platform === "linkedin"
      ? "professional, thought-leader tone. No emojis. Under 1200 chars."
      : "bold, studio-confident. Relevant hashtags. Under 300 chars.";
    const finalPrompt = isInline ? `${prompt}. ${tone}` : prompt;

    try {
      const data = await generateCaption({ platform, prompt: finalPrompt });
      const text = data.caption || "";
      // Stream directly into the caption box
      let i = 0;
      const step = 4;
      const interval = setInterval(() => {
        i += step;
        onAccept(text.slice(0, i));
        if (i >= text.length) { onAccept(text); clearInterval(interval); setLoading(false); }
      }, 14);
    } catch(e) {
      onAccept(e.message || "Couldn't reach AI.");
      setLoading(false);
    }
  };

  // Compact inline: just a prompt input with generate button
  if (isInline) {
    return (
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        <Sparkles size={12} style={{color:T.textDim,flexShrink:0}}/>
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === "Enter" && generate()}
          placeholder="Describe what to write..."
          style={{
            flex:1,background:"rgba(255,255,255,0.72)",border:`1px solid ${T.border}`,
            borderRadius:8,fontSize:11,padding:"7px 10px",outline:"none",color:T.text,
          }}/>
        <button onClick={generate} disabled={loading || !prompt.trim()}
          style={{
            background:loading ? T.s3 : T.ink,color:loading ? T.textDim : T.surface,
            border:"none",borderRadius:8,padding:"7px 10px",fontSize:10,fontWeight:700,
            cursor:loading ? "default" : "pointer",flexShrink:0,letterSpacing:"0.02em",
          }}>
          {loading ? "Writing..." : "Generate"}
        </button>
      </div>
    );
  }

  // Panel variant (full AI Writer in modals)
  return (
    <div className="ai-panel">
      <div className="ai-header"><span className="ai-title">AI Caption Writer</span></div>
      <div style={{display:"flex",gap:8}}>
        <input className="inp" style={{flex:1,fontSize:12.5}} value={prompt} onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&generate()} placeholder="Describe what you\u2019re posting\u2026"/>
        <button className="btn btn-ai" style={{padding:"7px 12px",fontSize:12,flexShrink:0}}
          onClick={generate} disabled={loading||!prompt.trim()}>{loading?"Writing\u2026":"Generate"}</button>
      </div>
    </div>
  );
}
