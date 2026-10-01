import { useState } from 'react';
import { Send, CircleCheck } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { Spinner } from './ui';
import { money } from '../lib/format';
import { totalWithChoice } from '../lib/report';

/** Name + signature + submit for the customer's approve/decline choices on a report. */
export default function ApprovalPanel({ report, decisions, onSubmit, busy, done, error, defaultName = '', submitLabel = 'Sign & send to the shop' }) {
  const [name, setName] = useState(defaultName);
  const [signature, setSignature] = useState(null);
  const pending = report.services.filter((s) => s.status === 'pending');
  const approved = pending.filter((s) => decisions[s.id] === 'approved');
  const declined = pending.filter((s) => decisions[s.id] === 'declined');
  const amount = approved.reduce((sum, s) => sum + (totalWithChoice(s, decisions) || 0), 0);
  const chosen = approved.length + declined.length;

  if (done)
    return (
      <div className="flex items-start gap-2.5 border-t border-line/70 bg-ok/[0.06] px-4 py-3 text-sm">
        <CircleCheck size={18} className="mt-0.5 shrink-0 text-ok" />
        <div>
          <div className="font-semibold text-ink">Thank you — your decision was sent.</div>
          <div className="text-ink-2">{done}</div>
        </div>
      </div>
    );

  return (
    <div className="space-y-3 border-t border-line/70 px-4 py-4">
      <div className="text-sm text-ink-2">
        {chosen ? (
          <>
            <span className="font-semibold text-ink">{approved.length} approved</span>
            {report.showPrices && approved.length > 0 && <> ({money(amount)} before tax)</>}
            {declined.length > 0 && <> · {declined.length} not now</>}
            {chosen < pending.length && <> · {pending.length - chosen} undecided</>}
          </>
        ) : (
          'Choose Approve or Not now for each item above.'
        )}
      </div>
      {chosen > 0 && (
        <>
          <label className="block">
            <span className="field-label">Your name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <SignaturePad onChange={setSignature} label="Sign with your finger or mouse" height={130} />
          <p className="text-xs text-ink-3">By signing you authorize the approved work at the prices shown. Declined items won’t be performed.</p>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button className="btn-primary w-full sm:w-auto" disabled={!name.trim() || !signature || busy} onClick={() => onSubmit({ name: name.trim(), signature })}>
            {busy ? <Spinner size={14} /> : <Send size={15} />} {submitLabel}
          </button>
        </>
      )}
    </div>
  );
}
