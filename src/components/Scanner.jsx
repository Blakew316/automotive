// Camera barcode scanner for VINs (door-jamb / windshield labels: Code 39, Code 128, Data Matrix,
// QR) and parts (UPC/EAN, Code 128). Uses the browser's built-in detector where it has one
// (Chrome, Edge, Android) and a bundled ZXing decoder everywhere else (Safari/iPhone, Firefox);
// the decoder only downloads the first time it's needed. Photos work too, for when the camera
// can't focus close enough.
import { useEffect, useRef, useState } from 'react';
import { ScanLine, Flashlight, ImageUp, X, Keyboard } from 'lucide-react';
import { Modal, Spinner } from './ui';
import { cleanVin, decodeOffline, vinFromScan as vinFrom } from '../lib/vin';

const VIN_FORMATS = ['code_39', 'code_128', 'data_matrix', 'qr_code'];
const PART_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'data_matrix', 'itf'];

let ponyfill = null;
async function detectorFor(formats) {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const want = formats.filter((f) => supported.includes(f));
      if (want.length) return new window.BarcodeDetector({ formats: want });
    } catch {
      // Fall back to the bundled decoder.
    }
  }
  if (!ponyfill) {
    ponyfill = (async () => {
      const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([import('barcode-detector/ponyfill'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
      prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
      return BarcodeDetector;
    })();
  }
  const Detector = await ponyfill;
  return new Detector({ formats });
}


/**
 * Full-screen-ish scanner. `mode` 'vin' returns a checked VIN; 'part' returns the raw barcode.
 * `onResult(value, raw)` is called once; the scanner closes itself.
 */
export default function Scanner({ mode = 'part', title, hint, onResult, onClose }) {
  const video = useRef(null);
  const file = useRef(null);
  const done = useRef(false);
  const detector = useRef(null);
  const trackRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');
  const [torch, setTorch] = useState(null);
  const [typed, setTyped] = useState('');
  const [manual, setManual] = useState(false);
  const formats = mode === 'vin' ? VIN_FORMATS : PART_FORMATS;

  const accept = (raw) => {
    if (done.current) return false;
    const value = mode === 'vin' ? vinFrom(raw) : String(raw || '').trim();
    if (!value) return false;
    done.current = true;
    navigator.vibrate?.(60);
    onResult(value, raw);
    onClose();
    return true;
  };

  useEffect(() => {
    let stream;
    let raf;
    let stopped = false;
    (async () => {
      try {
        detector.current = await detectorFor(formats);
        if (stopped) return;
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera'), { name: 'NotFoundError' });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (stopped) return;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        if (track?.getCapabilities?.().torch) setTorch(false);
        video.current.srcObject = stream;
        await video.current.play();
        setStatus('scanning');
        let busy = false;
        const tick = async () => {
          if (stopped || done.current) return;
          if (!busy && video.current?.readyState >= 2) {
            busy = true;
            try {
              const codes = await detector.current.detect(video.current);
              for (const c of codes) if (accept(c.rawValue)) return;
            } catch {
              // Frame not ready — keep scanning.
            }
            busy = false;
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        if (stopped) return;
        setStatus('error');
        setError(e.name === 'NotAllowedError' ? 'Camera permission was denied — allow it in the browser, or take a photo of the barcode instead.' : 'The camera isn’t available here — take a photo of the barcode or type it instead.');
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // Formats are fixed for the life of the scanner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromPhoto = async (f) => {
    if (!f) return;
    setStatus('reading');
    try {
      const d = detector.current || (await detectorFor(formats));
      const bitmap = await createImageBitmap(f);
      const codes = await d.detect(bitmap);
      bitmap.close?.();
      if (!codes.some((c) => accept(c.rawValue))) {
        setStatus('scanning');
        setError(mode === 'vin' ? 'No VIN barcode found in that photo — get closer and keep the label flat and in focus.' : 'No barcode found in that photo — try again closer.');
      }
    } catch {
      setStatus('scanning');
      setError('Couldn’t read that photo.');
    }
  };

  const toggleTorch = async () => {
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: !torch }] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  const typedOk = mode === 'vin' ? vinFrom(typed) : typed.trim();

  return (
    <Modal open layer="z-[65]" onClose={onClose} title={title || (mode === 'vin' ? 'Scan VIN' : 'Scan barcode')} subtitle={hint || (mode === 'vin' ? 'Point the camera at the VIN barcode on the door jamb or under the windshield.' : 'Point the camera at the part’s barcode.')} size="md">
      <div className="relative overflow-hidden rounded-[10px] bg-black">
        <video ref={video} playsInline muted className={`aspect-[4/3] w-full object-cover ${status === 'error' ? 'hidden' : ''}`} />
        {status === 'error' && <p className="px-6 py-14 text-center text-sm text-white/80">{error}</p>}
        {status === 'starting' && (
          <span className="absolute inset-0 flex items-center justify-center text-white/80">
            <Spinner size={22} />
          </span>
        )}
        {status === 'scanning' && <div className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[10px] border-2 border-white/85 ${mode === 'vin' ? 'h-20 w-[86%]' : 'h-36 w-[70%]'}`} />}
        {status === 'reading' && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <Spinner size={22} />
          </span>
        )}
        <button onClick={onClose} className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white" aria-label="Close scanner">
          <X size={16} />
        </button>
        {torch != null && (
          <button onClick={toggleTorch} className={`absolute left-2 top-2 rounded-full p-1.5 ${torch ? 'bg-white text-black' : 'bg-black/50 text-white'}`} aria-label="Flashlight">
            <Flashlight size={16} />
          </button>
        )}
      </div>
      {error && status !== 'error' && <p className="mt-2 text-sm text-warn">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-secondary btn-sm" onClick={() => file.current?.click()}>
          <ImageUp size={14} /> Use a photo
        </button>
        <button className="btn-plain btn-sm" onClick={() => setManual((m) => !m)}>
          <Keyboard size={14} /> Type it
        </button>
        <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fromPhoto(e.target.files?.[0])} aria-label="Barcode photo" />
      </div>
      {manual && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typedOk) accept(typed);
          }}
        >
          <input className={`input flex-1 ${mode === 'vin' ? 'font-mono uppercase tracking-wider' : ''}`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={mode === 'vin' ? '17-character VIN' : 'Barcode or part number'} autoFocus aria-label="Typed code" />
          <button className="btn-primary" disabled={!typedOk}>
            <ScanLine size={14} /> Use
          </button>
        </form>
      )}
      {mode === 'vin' && manual && cleanVin(typed).length === 17 && (!typedOk ? <p className="mt-1 text-xs text-bad">That isn’t a valid VIN — check for a mistyped character.</p> : decodeOffline(typedOk).checkDigitOk === false && <p className="mt-1 text-xs text-warn">The check digit doesn’t match — fine for some imports, otherwise look again for a typo.</p>)}
    </Modal>
  );
}

/** Small button that opens the scanner. */
export function ScanButton({ mode = 'part', onResult, label, className = 'btn-outline', title, hint, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={label || (mode === 'vin' ? 'Scan VIN' : 'Scan barcode')} title={label || (mode === 'vin' ? 'Scan VIN barcode' : 'Scan barcode')}>
        {children || <ScanLine size={15} />}
      </button>
      {open && <Scanner mode={mode} title={title} hint={hint} onResult={onResult} onClose={() => setOpen(false)} />}
    </>
  );
}
