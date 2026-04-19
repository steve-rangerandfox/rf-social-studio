import React, { useState } from "react";
import { Close as X, Heart, MessageSquare, Repeat as Repeat2, Send, ThumbsUp } from "../../../components/icons/index.jsx";

export function LinkedInPreview({ caption, mediaUrls, onClose }) {
  const truncLen = 150;
  const [expanded, setExpanded] = useState(false);
  const needsTrunc = caption && caption.length > truncLen;
  const displayCaption = expanded || !needsTrunc ? caption : caption.slice(0, truncLen) + "\u2026";
  const imgCount = mediaUrls.length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{width:520,maxWidth:"94vw"}} onClick={e=>e.stopPropagation()}>
        <div className="m-head">
          <div className="m-title">LinkedIn Preview</div>
          <button className="m-x" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="m-body" style={{padding:0}}>
          <div className="li-card">
            {/* Header */}
            <div className="li-header">
              <div className="li-avatar">RF</div>
              <div className="li-header-info">
                <div className="li-name">Ranger & Fox</div>
                <div className="li-meta">4,218 followers · 1h</div>
              </div>
            </div>
            {/* Caption */}
            {caption && (
              <div className="li-caption">
                {displayCaption.split("\n").map((line,i) => <span key={i}>{i>0&&<br/>}{line}</span>)}
                {needsTrunc && !expanded && (
                  <button className="li-more" onClick={e=>{e.stopPropagation();setExpanded(true);}}>see more</button>
                )}
              </div>
            )}
            {/* Images */}
            {imgCount > 0 && (
              <div className={`li-images li-images-${Math.min(imgCount, 5)}`}>
                {mediaUrls.slice(0, 5).map((url, i) => (
                  <div key={i} className={`li-img-cell li-img-${i}`}>
                    <img src={url} alt="" />
                    {i === 4 && imgCount > 5 && (
                      <div className="li-img-more">+{imgCount - 5}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Engagement bar */}
            <div className="li-engagement">
              <div className="li-reactions">
                <span className="li-react-icon" style={{background:"#0A66C2"}}><ThumbsUp size={10} color="#fff" /></span>
                <span className="li-react-icon" style={{background:"#DF704D",marginLeft:-4}}><Heart size={10} color="#fff" /></span>
                <span className="li-react-count">24</span>
              </div>
              <span className="li-stats">3 comments · 2 reposts</span>
            </div>
            <div className="li-actions">
              <button className="li-action-btn"><ThumbsUp size={14} /> Like</button>
              <button className="li-action-btn"><MessageSquare size={14} /> Comment</button>
              <button className="li-action-btn"><Repeat2 size={14} /> Repost</button>
              <button className="li-action-btn"><Send size={14} /> Send</button>
            </div>
          </div>
        </div>
        <div className="m-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
