// Ref callback for preview/thumbnail <video> elements. React sets the muted
// PROPERTY but not the muted ATTRIBUTE, so Chrome treats the element as
// unmuted and blocks autoplay — the video stays paused on frame 0 and paints
// nothing (transparent → the grey container shows through). Forcing
// el.muted = true then el.play() reliably paints the first frame (verified in
// a video harness: bare/preload videos = 0 non-blank px + paused; muted+play
// = full frame + playing).
export const autoplayMutedVideo = (el) => {
  if (!el) return;
  el.muted = true;
  el.playsInline = true;
  const p = el.play?.();
  if (p && typeof p.catch === "function") p.catch(() => {});
};

// Grab a poster frame from a local video blob so a video post has a
// thumbnail for the queue / grid / previews. Best-effort: resolves null on
// any failure (undecodable codec, timeout, canvas taint).
export const captureVideoPoster = (blobUrl) => new Promise((resolve) => {
  try {
    const vid = document.createElement("video");
    vid.muted = true;
    vid.crossOrigin = "anonymous";
    vid.src = blobUrl;
    vid.onloadeddata = () => { try { vid.currentTime = Math.min(0.1, (vid.duration || 1) / 2); } catch { resolve(null); } };
    vid.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = vid.videoWidth || 1080;
        canvas.height = vid.videoHeight || 1080;
        canvas.getContext("2d").drawImage(vid, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
      } catch { resolve(null); }
    };
    vid.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 4000);
  } catch { resolve(null); }
});
