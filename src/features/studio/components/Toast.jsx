import React, { useEffect } from "react";
import { T } from "../shared.js";

export function Toast({ msg, color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast"><div className="t-dot" style={{background:color||T.mint}}/>{msg}</div>;
}
