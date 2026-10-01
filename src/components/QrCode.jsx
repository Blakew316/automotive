// A crisp SVG QR code (for the key-drop sign, the lobby and printed handouts).
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

export default function QrCode({ text, size = 160, className = '', label = 'QR code' }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { path: d, count: n + 4 };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${count} ${count}`} width={size} height={size} className={className} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={count} height={count} fill="#fff" />
      <path d={path} fill="#0b1324" />
    </svg>
  );
}
