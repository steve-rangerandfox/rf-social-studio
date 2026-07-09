// Best-effort media metadata for capability checks: kind comes from the
// MIME type; for videos we probe durationSec via a throwaway <video>.
// Always resolves within ~2.5s — a missing duration just means the
// duration rules are skipped (capabilities.js ignores undefined).
export function probeFile(file) {
  const kind = file.type.startsWith("video/") ? "video" : "image";
  if (kind !== "video") return Promise.resolve({ kind });
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const done = (durationSec) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve({ kind, ...(durationSec ? { durationSec } : {}) });
    };
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => done(Number.isFinite(vid.duration) ? Math.round(vid.duration) : undefined);
    vid.onerror = () => done();
    setTimeout(() => done(), 2500);
    vid.src = url;
  });
}

export const probeFiles = (files) => Promise.all(files.map(probeFile));
