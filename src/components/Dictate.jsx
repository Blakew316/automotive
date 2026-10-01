// Speak instead of type: a mic button that turns speech into text using the browser's built-in
// speech recognition (Chrome, Edge, Safari on iPhone/iPad and Mac). Hidden where it isn't available.
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** Mic button; calls `onText` with each finished phrase. */
export default function DictateButton({ onText, label = 'Dictate', className = '' }) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const rec = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  useEffect(() => () => rec.current?.abort(), []);
  if (!Recognition) return null;

  const start = () => {
    const r = new Recognition();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const text = res[0].transcript.trim();
          if (text) onTextRef.current(text.charAt(0).toUpperCase() + text.slice(1));
        } else interim += res[0].transcript;
      }
      setPartial(interim);
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      setPartial('');
    };
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => (listening ? rec.current?.stop() : start())}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${listening ? 'animate-pulse bg-bad text-white' : 'text-ink-3 hover:bg-fill/[0.1] hover:text-ink'}`}
        aria-label={listening ? 'Stop dictating' : label}
        title={listening ? 'Listening… tap to stop' : label}
      >
        {listening ? <MicOff size={14} /> : <Mic size={14} />}
      </button>
      {listening && partial && <span className="absolute bottom-full right-0 z-10 mb-1 max-w-[240px] truncate rounded-[6px] bg-ink px-2 py-1 text-xs text-canvas shadow-pop">{partial}</span>}
    </span>
  );
}
