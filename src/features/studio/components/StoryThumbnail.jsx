import React, { useState, useRef, useEffect } from "react";

// Canvas design space: 290x515. Thumbnail uses percentage positioning so it
// scales correctly regardless of the thumbnail's rendered size.
const CW = 290, CH = 515;

export function StoryThumbnail({ elements, onClick }) {
  const bgEl  = elements.find(e => e.locked);
  const isVid = bgEl?.mediaType === 'video';
  const videoRef = useRef(null);
  const thumbRef = useRef(null);
  const [tw, setTw] = useState(100); // thumbnail rendered width for font scaling

  useEffect(() => {
    if (!thumbRef.current) return;
    const ro = new ResizeObserver(([entry]) => setTw(entry.contentRect.width));
    ro.observe(thumbRef.current);
    return () => ro.disconnect();
  }, []);

  const s = tw / CW; // scale factor: thumb px per canvas px

  const handleEnter = () => { if (videoRef.current) videoRef.current.play().catch(()=>{}); };
  const handleLeave = () => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } };

  return (
    <div className="story-thumb-container" onClick={onClick} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <div className="story-thumb-preview" ref={thumbRef}>
        {bgEl?.url && bgEl.mediaType !== 'video' && <img src={bgEl.url} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} alt=""/>}
        {bgEl?.url && isVid  && <video ref={videoRef} src={bgEl.url} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} loop muted playsInline/>}
        {bgEl?.url && <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.75) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,.28) 100%)',pointerEvents:'none'}}/>}
        {elements.filter(e => !e.locked && e.type === 'text').map(el => (
          <div key={el.id} className="thumb-el" style={{
            left: `${(el.x / CW) * 100}%`,
            top: `${(el.y / CH) * 100}%`,
            fontSize: (el.fontSize || 14) * s,
            color: el.color || '#fff',
            fontFamily: `'${el.fontFamily || 'Bricolage Grotesque'}', sans-serif`,
            fontWeight: el.fontWeight || 600,
            letterSpacing: (el.letterSpacing || 0) * s,
            textShadow: el.shadow ? '0 1px 4px rgba(0,0,0,.8)' : undefined,
            width: `${((el.boxWidth || 190) / CW) * 100}%`,
          }}>{el.content}</div>
        ))}
        {elements.filter(e => !e.locked && e.type === 'image' && e.url).map(el => (
          <div key={el.id} style={{
            position:'absolute',
            left: `${(el.x / CW) * 100}%`,
            top: `${(el.y / CH) * 100}%`,
            width: ((el.width || 140) * (el.scale || 1) / CW * 100) + '%',
            height: ((el.height || 140) * (el.scale || 1) / CH * 100) + '%',
            pointerEvents:'none',
          }}>
            {el.mediaType === 'video'
              ? <video src={el.url} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:2}} muted playsInline loop/>
              : <img src={el.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:2}}/>}
          </div>
        ))}
        {!bgEl?.url && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:18,opacity:.2,color:'#fff'}}></span>
        </div>}
        <div style={{position:'absolute',bottom:6,right:6,fontFamily:"'JetBrains Mono',monospace",fontSize:5.5,color:'rgba(255,255,255,.2)',letterSpacing:2,textTransform:'uppercase',pointerEvents:'none'}}>R&F</div>
        <div className="story-thumb-overlay">
          <button className="story-thumb-btn">Open Designer</button>
        </div>
      </div>
    </div>
  );
}
