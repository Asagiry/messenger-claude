import { useState, useMemo } from 'react';

interface Props {
  src?: string;
  name: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
}

// Deterministic gradient per name
const palettes: [string, string][] = [
  ['#7c5cff', '#3ddc97'],
  ['#ff6b6b', '#ffa94d'],
  ['#4dabf7', '#9277ff'],
  ['#22c55e', '#0ea5e9'],
  ['#f59e0b', '#ef4444'],
  ['#06b6d4', '#a855f7'],
  ['#ec4899', '#8b5cf6'],
  ['#10b981', '#3b82f6'],
];
function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({ src, name, size = 40, online, ring }: Props) {
  const [broken, setBroken] = useState(false);
  const showImg = !!src && !broken;
  const initial = (name || '?').charAt(0).toUpperCase();
  const [c1, c2] = useMemo(() => palettes[hash(name) % palettes.length], [name]);
  const dotSize = Math.max(10, Math.round(size * 0.28));

  return (
    <div
      className={`relative inline-block shrink-0 ${ring ? 'rounded-full ring-2 ring-brand/40 ring-offset-2 ring-offset-bg-card' : ''}`}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={src}
          alt={name}
          onError={() => setBroken(true)}
          className="rounded-full object-cover w-full h-full bg-bg-line"
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-semibold text-white w-full h-full select-none"
          style={{
            background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
            fontSize: size * 0.42,
            letterSpacing: '-0.02em',
          }}
        >
          {initial}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full transition-colors ${
            online ? 'bg-success' : 'bg-ink-mute'
          }`}
          style={{
            width: dotSize,
            height: dotSize,
            boxShadow: `0 0 0 2px rgb(var(--bg-card))`,
          }}
        />
      )}
    </div>
  );
}
