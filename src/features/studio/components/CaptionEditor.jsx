import React, { useState, useRef } from "react";
import { MENTIONS, T } from "../shared.js";
import { AICaptionAssist } from "./AICaptionAssist.jsx";

export function CaptionEditor({ value, onChange, platform, note }) {
  const [mq, setMq] = useState(null); const [res, setRes] = useState([]);
  const [showAI, setShowAI] = useState(false);
  const ref = useRef(null);
  const max = platform==="linkedin"?3000:2200;
  const over = value.length>max, warn = value.length>max*0.88;
  const onCh = (e) => {
    const v=e.target.value; onChange(v);
    const b=v.slice(0,e.target.selectionStart), m=b.match(/@(\w*)$/);
    if(m){setMq(m[1]);setRes(MENTIONS.filter(x=>x.name.toLowerCase().includes(m[1].toLowerCase())||x.handle.includes(m[1].toLowerCase())).slice(0,5));}
    else setMq(null);
  };
  const pick=(item)=>{const el=ref.current,c=el.selectionStart;const before=value.slice(0,c).replace(/@\w*$/,`@${item.handle} `);onChange(before+value.slice(c));setMq(null);setTimeout(()=>{el.focus();el.setSelectionRange(before.length,before.length);},0);};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="lbl">Caption</span>
        <button className="btn btn-ai" style={{padding:"4px 10px",fontSize:11}} onClick={()=>setShowAI(v=>!v)}>{showAI?"Hide AI":"Write with AI"}</button>
      </div>
      {showAI&&<AICaptionAssist variant="panel" platform={platform} note={note} onAccept={(t)=>{onChange(t);setShowAI(false);}}/>}
      <div className="mw">
        <textarea ref={ref} className="txa" value={value} onChange={onCh} placeholder="Write your caption\u2026 use @ to tag"/>
        <div className="char-row"><span className={`char ${over?"over":warn?"warn":""}`}>{value.length}/{max}</span></div>
        {mq!==null&&res.length>0&&<div className="md">{res.map(m=><div key={m.id} className="mi" onClick={()=>pick(m)}><div className="ma">{m.name[0]}</div><div><div className="mn">{m.name}</div><div className="mh">@{m.handle}</div></div></div>)}</div>}
      </div>
    </div>
  );
}
