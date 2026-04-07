import React, { useEffect, useState } from "react";
import { useStudio } from "../StudioContext.jsx";

export function UndoToast() {
  const { pendingUndo, triggerUndo, dismissUndo } = useStudio();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!pendingUndo) return undefined;
    setProgress(100);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / 10000) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [pendingUndo]);

  if (!pendingUndo) return null;

  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast-msg">{pendingUndo.message}</span>
      <button className="undo-toast-btn" onClick={triggerUndo}>Undo</button>
      <button className="undo-toast-dismiss" onClick={dismissUndo} aria-label="Dismiss">×</button>
      <div className="undo-toast-progress" style={{ width: `${progress}%` }} />
    </div>
  );
}
