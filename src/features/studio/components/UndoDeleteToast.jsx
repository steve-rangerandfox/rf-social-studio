import React, { useState, useEffect } from "react";
import { T } from "../shared.js";

export function UndoDeleteToast({ count, onUndo, onDone }) {
  const [secs, setSecs] = useState(5);
  useEffect(() => {
    const interval = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(interval); onDone(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(interval);
  }, [onDone]);
  return (
    <div className="toast" style={{display:'flex',alignItems:'center',gap:10}}>
      <div className="t-dot" style={{background:T.red}}/>
      <span>{count} post{count !== 1 ? 's' : ''} deleted ({secs}s)</span>
      <button onClick={onUndo} style={{
        background:T.s3, border:`1px solid ${T.border2}`, borderRadius:5,
        padding:'3px 10px', fontSize:11.5, fontWeight:700, cursor:'pointer', color:T.text, marginLeft:4,
      }}>Undo</button>
    </div>
  );
}
