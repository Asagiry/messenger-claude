import { useState } from 'react';

interface Props {
  src?: string;
  name: string;
  size?: number;
  online?: boolean;
}

export default function Avatar({ src, name, size = 40, online }: Props) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const showImg = !!src && !broken;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {showImg ? (
        <img
          src={src}
          alt={name}
          onError={() => setBroken(true)}
          className="rounded-full object-cover w-full h-full bg-bg-line"
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-semibold text-white w-full h-full"
          style={{
            background: `linear-gradient(135deg, #7c5cff 0%, #3ddc97 100%)`,
            fontSize: size * 0.42,
          }}
        >
          {initial}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-bg-card ${online ? 'bg-success' : 'bg-ink-mute'}`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
