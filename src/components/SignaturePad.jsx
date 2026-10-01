import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

/** Finger/mouse signature on a paper-white pad. Calls onChange(dataUrl | null). */
export default function SignaturePad({ onChange, height = 150, label = 'Sign here' }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#111';
  }, [height]);

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = point(e);
    const ctx = canvas.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!empty) onChange?.(exportSignature(canvas.current));
  };
  const clear = () => {
    const c = canvas.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange?.(null);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-[10px] border border-line bg-white" style={{ height }}>
        <canvas
          ref={canvas}
          className="block h-full w-full touch-none"
          style={{ height }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          aria-label={label}
          role="img"
        />
        {empty && <span className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-neutral-400">{label}</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-5 border-b border-neutral-300" />
      </div>
      <div className="mt-1.5 flex justify-end">
        <button type="button" className="btn-plain btn-sm" onClick={clear} disabled={empty}>
          <Eraser size={13} /> Clear
        </button>
      </div>
    </div>
  );
}

/** Downscale to a compact PNG so signatures stay small in saved data. */
function exportSignature(src) {
  const w = Math.min(560, src.width);
  const h = Math.round((src.height / src.width) * w);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(src, 0, 0, w, h);
  return out.toDataURL('image/png');
}
