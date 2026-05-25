import { useEffect, useRef } from 'react';

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳',
  '🤔','🙃','😅','😇','🤗','🤭','🤫','🤐','😴','🙄',
  '😭','😢','😡','🤯','🥺','😱','😳','😬','😉','😋',
  '👍','👎','👏','🙏','💪','🫶','🤝','✌️','🤞','🤘',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯',
  '🔥','✨','⭐','🌟','💫','⚡','🎉','🎊','🎁','🚀',
  '☕','🍕','🍔','🍰','🍩','🍪','🍎','🍓','🥑','🍷',
  '🐶','🐱','🐭','🦊','🐻','🐼','🦁','🐯','🦄','🐢',
];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-30 card p-2 w-72 animate-scale-in origin-bottom-left"
    >
      <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="text-xl w-8 h-8 rounded-md hover:bg-bg-line/60 transition-colors flex items-center justify-center"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
