import React from "react";

export function PlatformIcon({ platform, size = 16 }) {
  if (platform === "linkedin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{display:"block"}}>
        <rect width="24" height="24" rx="4" fill="#0A66C2"/>
        <path d="M7.5 10v7h-2v-7h2zm-1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM9.5 10h1.9v1h.03c.27-.5 1-1.1 2.07-1.1 2.2 0 2.6 1.45 2.6 3.34V17h-2v-3.4c0-.8-.01-1.85-1.13-1.85-1.13 0-1.3.88-1.3 1.8V17h-2v-7z" fill="#fff"/>
      </svg>
    );
  }
  // Instagram (ig_post, ig_story)
  const id = "ig-grad-" + size;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{display:"block"}}>
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${id})`}/>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="#fff" strokeWidth="1.5" fill="none"/>
      <circle cx="12" cy="12" r="3.8" stroke="#fff" strokeWidth="1.5" fill="none"/>
      <circle cx="17" cy="7" r="1.1" fill="#fff"/>
    </svg>
  );
}
