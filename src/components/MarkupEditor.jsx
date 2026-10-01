// Draw on a photo before the customer sees it: arrows, circles, freehand and labels. Saves a new
// photo and keeps the original, so nothing the technician took is ever lost.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoveUpRight, Circle, PenLine, Type, Undo2, Trash2, X, Check } from 'lucide-react';
import { Spinner } from './ui';

const TOOLS = [
  { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'pen', label: 'Draw', icon: PenLine },
  { id: 'text', label: 'Label', icon: Type },
];
const COLORS = [
  { id: 'red', label: 'Red', value: '#ef3b3b' },
  { id: 'yellow', label: 'Yellow', value: '#ffd23f' },
  { id: 'white', label: 'White', value: '#ffffff' },
];

function drawShape(ctx, s, W) {
  const lw = Math.max(4, W / 180);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = lw;
  // A soft dark edge keeps every mark readable on bright and dark parts of the photo.
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = lw * 1.2;
  if (s.tool === 'arrow') {
    const [a, b] = s.points;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = lw * 4.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x - Math.cos(ang) * head * 0.6, b.y - Math.sin(ang) * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45));
    ctx.lineTo(b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  } else if (s.tool === 'circle') {
    const [a, b] = s.points;
    ctx.beginPath();
    ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.tool === 'pen') {
    ctx.beginPath();
    s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  } else if (s.tool === 'text') {
    const size = Math.max(26, W / 26);
    ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.lineWidth = size / 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    const { x, y } = s.points[0];
    ctx.strokeText(s.text, x, y);
    ctx.fillText(s.text, x, y);
  }
  ctx.restore();
}

const big = (s, W) => {
  if (s.tool === 'pen') return s.points.length > 1;
  if (s.tool === 'text') return Boolean(s.text);
  const [a, b] = s.points;
  return Math.hypot(b.x - a.x, b.y - a.y) > W / 80;
};

/** Full-screen photo markup. `onSave(blob, { replaceForCustomer })` receives the finished JPEG. */
export default function MarkupEditor({ src, onSave, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const drag = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [tool, setTool] = useState('arrow');
  const [color, setColor] = useState(COLORS[0].value);
  const [shapes, setShapes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [label, setLabel] = useState(null); // { x, y, cx, cy, text } while typing a label
  const [replace, setReplace] = useState(true);
  const [saving, setSaving] = useState(false);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const s of shapes) drawShape(ctx, s, c.width);
    if (draft) drawShape(ctx, draft, c.width);
  }, [shapes, draft]);

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = canvasRef.current;
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      imgRef.current = img;
      setReady(true);
    };
    img.onerror = () => alive && setError('This photo couldn’t be opened for markup.');
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    if (ready) redraw();
  }, [ready, redraw]);

  const undo = useCallback(() => setShapes((list) => list.slice(0, -1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, undo]);

  const at = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };

  // The label being typed lives in a ref too, so Enter followed by blur can't add it twice.
  const labelRef = useRef(null);
  const editLabel = (next) => {
    labelRef.current = next;
    setLabel(next);
  };
  const commitLabel = () => {
    const l = labelRef.current;
    editLabel(null);
    if (l?.text.trim()) setShapes((list) => [...list, { tool: 'text', color, points: [{ x: l.x, y: l.y }], text: l.text.trim() }]);
  };
  // Labels open on click (after the browser has moved focus), so the text box keeps focus.
  const click = (e) => {
    if (!ready || tool !== 'text') return;
    editLabel({ ...at(e), cx: e.clientX, cy: e.clientY, text: '' });
  };

  const down = (e) => {
    if (!ready || e.button > 0 || tool === 'text') return;
    const p = at(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { tool, color, points: tool === 'pen' ? [p] : [p, p] };
    setDraft(drag.current);
  };
  const move = (e) => {
    if (!drag.current) return;
    const p = at(e);
    const d = drag.current;
    drag.current = { ...d, points: d.tool === 'pen' ? [...d.points, p] : [d.points[0], p] };
    setDraft(drag.current);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    setDraft(null);
    if (d && big(d, canvasRef.current.width)) setShapes((list) => [...list, d]);
  };

  const save = () => {
    const c = canvasRef.current;
    setSaving(true);
    c.toBlob(
      async (blob) => {
        try {
          await onSave(blob, { replaceForCustomer: replace });
        } finally {
          setSaving(false);
        }
      },
      'image/jpeg',
      0.88,
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Mark up photo">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <button onClick={onClose} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-white/80 hover:bg-white/10" aria-label="Cancel markup">
          <X size={17} /> Cancel
        </button>
        <div className="mx-auto flex items-center gap-1 rounded-full bg-white/10 p-1" role="radiogroup" aria-label="Tool">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tool === t.id}
              onClick={() => setTool(t.id)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm ${tool === t.id ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10'}`}
            >
              <t.icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={color === c.value}
              aria-label={c.label}
              onClick={() => setColor(c.value)}
              className={`h-7 w-7 rounded-full border-2 ${color === c.value ? 'border-white ring-2 ring-white/40' : 'border-white/30'}`}
              style={{ background: c.value }}
            />
          ))}
        </div>
        <button onClick={undo} disabled={!shapes.length} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30" aria-label="Undo" title="Undo">
          <Undo2 size={17} />
        </button>
        <button onClick={() => setShapes([])} disabled={!shapes.length} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30" aria-label="Clear all marks" title="Clear all">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {!ready && !error && <Spinner size={22} className="absolute text-white/70" />}
        {error && <p className="absolute text-sm text-white/80">{error}</p>}
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onClick={click}
          className={`max-h-full max-w-full touch-none rounded-[4px] ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'} ${ready ? '' : 'invisible'}`}
          aria-label="Photo — drag to draw"
          data-testid="markup-canvas"
        />
        {label && (
          <input
            autoFocus
            value={label.text}
            onChange={(e) => editLabel({ ...label, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') editLabel(null);
            }}
            onBlur={commitLabel}
            placeholder="Type a label"
            aria-label="Label text"
            className="fixed z-[71] w-48 -translate-y-1/2 rounded-[6px] border border-white/40 bg-black/70 px-2 py-1 text-sm font-semibold text-white outline-none placeholder:text-white/50"
            style={{ left: Math.min(label.cx, window.innerWidth - 200), top: label.cy, color }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-white/85">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4 accent-white" />
          Customer sees only the marked-up photo
        </label>
        <button onClick={save} disabled={!ready || !shapes.length || saving} className="btn-primary btn-lg min-w-[140px] disabled:opacity-40">
          {saving ? <Spinner size={15} /> : <Check size={16} />} Save photo
        </button>
      </div>
    </div>,
    document.body,
  );
}
