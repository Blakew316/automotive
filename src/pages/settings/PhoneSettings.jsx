// Settings → Messaging → Business texting & calls: connect the shop's Twilio number, choose which
// phones ring, voicemail and the missed-call text, the AI receptionist, after-hours replies and
// automatic appointment texts.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, Check, Plus, Trash2, Sparkles, MessageSquare, Lock, RefreshCw, ShieldCheck, Send } from 'lucide-react';
import { useShop, useSync, useAccess, useUI, usePhone } from '../../store/hooks';
import { Card, CardHeader, Field, Toggle, Spinner, InlineText, ExternalLink, CopyButton } from '../../components/ui';
import { shopPhone } from '../../lib/sync/api';
import { lineSettings, RECEPTIONIST_MODES, RECEPTIONIST_MODELS, VOICES, e164 } from '../../lib/phone';
import { phone as fmtPhone, relTime } from '../../lib/format';
import { PRODUCT } from '../../brand/artwork';

export default function PhoneSettings() {
  const { state, updateShop } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const phone = usePhone();
  const st = phone.status;
  const line = lineSettings(state.shop);
  const owner = role === 'owner';
  const canEdit = ['owner', 'manager'].includes(role);
  const set = (patch) => updateShop({ phoneLine: { ...line, ...patch } });
  const [busy, setBusy] = useState(false);
  const { refresh } = phone;
  // Keys may have just been saved in Keys & AI: check the line again when this screen opens.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await shopPhone(sync.cfg, 'connect');
      toast(`Connected ${fmtPhone(r.phone)} — texts and calls now come to ${PRODUCT}`, { tone: 'success' });
      phone.refresh();
    } catch (e) {
      toast(e.message || 'Couldn’t connect the number', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!sync?.staff)
    return (
      <Card className="px-4 py-4 text-sm text-ink-2">
        <Lock size={16} className="mb-2 text-ink-3" />
        Business texting and calling run on your Shop Cloud server. Sign in under Settings → Shop Cloud to set them up.
      </Card>
    );

  return (
    <Card>
      <CardHeader
        title="Business texting & calls"
        icon={PhoneCall}
        subtitle={st?.connected ? `Connected · ${fmtPhone(st.phone)}${st.connectedAt ? ` · since ${relTime(st.connectedAt)}` : ''}` : 'Text and call customers from your shop’s number, with an AI receptionist for missed calls'}
        actions={
          st?.connected && owner ? (
            <button className="btn-plain btn-sm" onClick={connect} disabled={busy} title={`Point the number at ${PRODUCT} again`}>
              {busy ? <Spinner size={13} /> : <RefreshCw size={13} />} Reconnect
            </button>
          ) : null
        }
      />
      {!st ? (
        <div className="flex items-center justify-center py-8 text-ink-3">
          <Spinner size={18} />
        </div>
      ) : !st.connected ? (
        <Setup st={st} owner={owner} busy={busy} onConnect={connect} />
      ) : (
        <div className="divide-y divide-line/70">
          <Row className="px-4 py-3" title="Send texts from the business number" body="Texts from Messages, repair orders and follow-ups go out from your Twilio number, replies arrive here automatically, and you can see when each one is delivered. Off: texts open in this device’s Messages app instead.">
            <Toggle checked={line.enabled !== false} onChange={(v) => set({ enabled: v })} disabled={!canEdit} label="Send texts from the business number" />
          </Row>

          <Section title="Calls">
            <ForwardList line={line} canEdit={canEdit} onChange={(forward) => set({ forward })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ring for">
                {(id) => (
                  <select id={id} className="input" value={line.ringSeconds} disabled={!canEdit} onChange={(e) => set({ ringSeconds: Number(e.target.value) })}>
                    {[15, 20, 25, 30, 40].map((n) => (
                      <option key={n} value={n}>{n} seconds (about {Math.round(n / 5)} rings)</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field label="Voicemail greeting" hint="Leave blank for: “Thanks for calling {shop}… please leave your name, number and a short message.” After hours it also reads your hours.">
              {(id) => <InlineText id={id} multiline rows={2} className="input resize-none" value={line.voicemailGreeting} onCommit={(v) => set({ voicemailGreeting: v.trim() })} disabled={!canEdit} placeholder="Thanks for calling {shop}…" />}
            </Field>
            <ToggleText
              label="Missed-call text"
              hint="When nobody answers (and the receptionist didn’t take the call), the caller gets this text so they can reply instead of calling back."
              on={line.textBack}
              text={line.textBackBody}
              canEdit={canEdit}
              onToggle={(v) => set({ textBack: v })}
              onText={(v) => set({ textBackBody: v })}
            />
          </Section>

          <Section title="AI receptionist" icon={Sparkles}>
            {!st.aiReady && (
              <p className="rounded-[10px] border border-warn/40 bg-warn/[0.07] px-3 py-2 text-sm">
                The receptionist runs on Claude through your Anthropic API key. {owner ? <Link to="/settings?tab=keys" className="link">Add it in Keys & AI</Link> : 'The owner adds it in Settings → Keys & AI.'} Until then calls go to voicemail.
              </p>
            )}
            <fieldset className="space-y-1.5" disabled={!canEdit}>
              <legend className="field-label">When it answers</legend>
              {RECEPTIONIST_MODES.map((m) => (
                <label key={m.value} className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2 ${line.receptionist === m.value ? 'border-accent/60 bg-accent/[0.05]' : 'border-line hover:bg-fill/[0.03]'}`}>
                  <input type="radio" name="receptionist" className="mt-1" checked={line.receptionist === m.value} onChange={() => set({ receptionist: m.value })} />
                  <span>
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-ink-3">{m.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {line.receptionist !== 'off' && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Voice">
                    {(id) => (
                      <select id={id} className="input" value={line.voice} disabled={!canEdit} onChange={(e) => set({ voice: e.target.value })}>
                        {VOICES.map((v) => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Model">
                    {(id) => (
                      <select id={id} className="input" value={line.receptionistModel} disabled={!canEdit} onChange={(e) => set({ receptionistModel: e.target.value })}>
                        {RECEPTIONIST_MODELS.map((v) => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
                <Field label="Greeting" hint="Leave blank for: “Thanks for calling {shop}. This is the shop’s virtual assistant. How can I help you today?” Known callers are greeted by name.">
                  {(id) => <InlineText id={id} className="input" value={line.greeting} onCommit={(v) => set({ greeting: v.trim() })} disabled={!canEdit} placeholder="Thanks for calling {shop}…" />}
                </Field>
                <Field label="What the receptionist should know" hint="Policies, fees and answers to common questions. It never makes up prices or diagnoses — anything not here becomes a message for you.">
                  {(id) => (
                    <InlineText
                      id={id}
                      multiline
                      rows={5}
                      className="input"
                      value={line.knowledge}
                      onCommit={(v) => set({ knowledge: v.trim() })}
                      disabled={!canEdit}
                      placeholder={'Diagnostic fee is $149 and goes toward the repair.\nFree shuttle within 5 miles. Loaners for jobs over $1,000.\nWe don’t work on motorcycles or diesel semis.\nWarranty: 24 months / 24,000 miles on parts and labor.'}
                    />
                  )}
                </Field>
                <Row title="Tell callers where their vehicle is" body="Only when the caller ID matches the customer’s number on file: status and promised time, never prices.">
                  <Toggle checked={line.allowStatus} onChange={(v) => set({ allowStatus: v })} disabled={!canEdit} label="Tell callers where their vehicle is" />
                </Row>
                <Row title="Take appointment requests" body="Requests land in Calendar → Requests for you to confirm; the caller is told the shop will confirm the time.">
                  <Toggle checked={line.allowBooking} onChange={(v) => set({ allowBooking: v })} disabled={!canEdit} label="Take appointment requests" />
                </Row>
                <p className="flex items-start gap-2 text-xs text-ink-3">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                  The receptionist says it’s a virtual assistant, follows only your settings, and transfers to your phones when a caller asks for a person (during hours). Each call is transcribed and summarized in Messages, and appointment requests show up in the calendar. Voicemails are recorded; the receptionist’s side of the call is transcribed, not recorded. Usage counts toward the AI limit in Keys & AI.
                </p>
              </>
            )}
          </Section>

          <Section title="Texts" icon={MessageSquare}>
            <ToggleText
              label="After-hours auto-reply"
              hint="Sent once a day per number when a text arrives while you’re closed."
              on={line.afterHoursReply}
              text={line.afterHoursBody}
              canEdit={canEdit}
              onToggle={(v) => set({ afterHoursReply: v })}
              onText={(v) => set({ afterHoursBody: v })}
            />
            <Row title="Appointment confirmations" body="Texted as soon as an appointment is booked (from the “Appointment reminder” template).">
              <Toggle checked={line.autoConfirm} onChange={(v) => set({ autoConfirm: v, autoSince: line.autoSince || new Date().toISOString() })} disabled={!canEdit} label="Appointment confirmations" />
            </Row>
            <Row
              title="Day-before reminders"
              body={
                <>
                  Sent the day before at{' '}
                  <select className="input inline-block h-7 w-auto py-0 text-xs" value={line.reminderHour} disabled={!canEdit} onChange={(e) => set({ reminderHour: Number(e.target.value) })} aria-label="Reminder time">
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
                      <option key={h} value={h}>{`${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`}</option>
                    ))}
                  </select>
                  , even if no one has the app open. Never before 8 AM or after 9 PM.
                </>
              }
            >
              <Toggle checked={line.autoReminder} onChange={(v) => set({ autoReminder: v, autoSince: line.autoSince || new Date().toISOString() })} disabled={!canEdit} label="Day-before reminders" />
            </Row>
            {st.optOuts?.length > 0 && (
              <p className="text-xs text-ink-3">
                {st.optOuts.length} number{st.optOuts.length === 1 ? ' has' : 's have'} replied STOP — nothing is sent to {st.optOuts.length === 1 ? 'it' : 'them'} until they reply START.
              </p>
            )}
            {owner && <TestText />}
          </Section>

          <Section title="Carrier registration">
            <p className="text-sm text-ink-2">
              U.S. carriers block business texts from numbers that aren’t registered. In the Twilio console, register your number for <b>A2P 10DLC</b> (local numbers) or complete <b>toll-free verification</b> (8XX numbers) — usually a few days. Calls work right away.{' '}
              <ExternalLink href="https://www.twilio.com/docs/messaging/compliance/a2p-10dlc">How to register</ExternalLink>
            </p>
            <details className="text-xs text-ink-3">
              <summary className="cursor-pointer">Webhook addresses (set automatically)</summary>
              <p className="mt-1.5">Connecting sets these on your number. If the number belongs to a Twilio Messaging Service, set the service’s incoming-message webhook to the texts address too.</p>
              {[
                ['Texts', `${st.webhook}?t=sms`],
                ['Calls', `${st.webhook}?t=voice`],
                ['Call status', `${st.webhook}?t=callstatus`],
              ].map(([k, v]) => (
                <div key={k} className="mt-1 flex items-center gap-2">
                  <span className="w-20 shrink-0">{k}</span>
                  <code className="min-w-0 flex-1 truncate rounded bg-fill/[0.06] px-1.5 py-0.5">{v}</code>
                  <CopyButton text={v} label={`Copy ${k.toLowerCase()} address`} />
                </div>
              ))}
            </details>
          </Section>
        </div>
      )}
    </Card>
  );
}

function Setup({ st, owner, busy, onConnect }) {
  const steps = [
    { done: true, text: <>Create a Twilio account and buy (or port) a local number with texting and voice. <ExternalLink href="https://www.twilio.com/console">Twilio console</ExternalLink></> },
    { done: st.configured, text: <>Add the Account SID, Auth token and the number in <Link to="/settings?tab=keys" className="link">Keys & AI</Link>.</> },
    { done: false, text: `Connect the number — ${PRODUCT} sets up its texting and calling for you.` },
    { done: false, text: 'Register the number for business texting in Twilio (A2P 10DLC or toll-free verification).' },
  ];
  return (
    <div className="space-y-3 px-4 pb-4 text-sm">
      <p className="text-ink-2">
        Two-way texting from your shop’s number with delivery receipts, calls that ring every phone at the counter, voicemail, a text back to anyone you miss, and an AI receptionist that answers when you can’t. It runs on your own Twilio account (billed by Twilio per text and minute).
      </p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${s.done && i === 1 ? 'bg-ok text-white' : 'bg-fill/[0.1] text-ink-2'}`}>{s.done && i === 1 ? <Check size={11} /> : i + 1}</span>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      {st.configured ? (
        owner ? (
          <button className="btn-primary" onClick={onConnect} disabled={busy}>
            {busy ? <Spinner size={14} /> : <PhoneCall size={15} />} Connect {fmtPhone(st.phone)}
          </button>
        ) : (
          <p className="text-ink-3">The owner connects the number.</p>
        )
      ) : null}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="space-y-3 px-4 py-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {Icon && <Icon size={14} className="text-accent" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ title, body, children, className = '' }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-ink-3">{body}</div>
      </div>
      {children}
    </div>
  );
}

function ToggleText({ label, hint, on, text, canEdit, onToggle, onText }) {
  return (
    <div className="space-y-2">
      <Row title={label} body={hint}>
        <Toggle checked={on} onChange={onToggle} disabled={!canEdit} label={label} />
      </Row>
      {on && <InlineText multiline rows={2} className="input resize-none text-sm" value={text} onCommit={(v) => onText(v.trim())} disabled={!canEdit} aria-label={`${label} text`} />}
    </div>
  );
}

function ForwardList({ line, canEdit, onChange }) {
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const add = (e) => {
    e.preventDefault();
    if (!e164(number)) return;
    onChange([...line.forward, { number: fmtPhone(number), label: label.trim() }]);
    setNumber('');
    setLabel('');
  };
  return (
    <div>
      <div className="field-label">Ring these phones</div>
      <p className="mb-2 text-xs text-ink-3">They all ring at once; the first to answer gets the call. When you call customers from {PRODUCT}, they see the shop’s number.</p>
      <ul className="mb-2 space-y-1.5">
        {line.forward.map((f, i) => (
          <li key={`${f.number}-${i}`} className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-1.5 text-sm">
            <PhoneCall size={13} className="text-ink-3" />
            <span className="font-medium">{f.label || 'Phone'}</span>
            <span className="text-ink-3">{fmtPhone(f.number)}</span>
            {canEdit && (
              <button className="btn-ghost btn-icon ml-auto h-7 w-7 text-ink-3 hover:text-bad" onClick={() => onChange(line.forward.filter((_, j) => j !== i))} aria-label={`Remove ${f.label || fmtPhone(f.number)}`}>
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
        {!line.forward.length && <li className="text-xs text-ink-3">No phones yet — calls go straight to the receptionist or voicemail.</li>}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap gap-1.5">
          <input className="input w-36" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front counter" aria-label="Phone name" />
          <input className="input w-44" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="(512) 555-0111" inputMode="tel" aria-label="Phone number to ring" />
          <button className="btn-secondary" disabled={!e164(number)}>
            <Plus size={14} /> Add
          </button>
        </form>
      )}
    </div>
  );
}

function TestText() {
  const sync = useSync();
  const { toast } = useUI();
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await shopPhone(sync.cfg, 'send', { to, body: `Test text from ${PRODUCT} — your business line is working.` });
      toast('Test text sent', { tone: 'success' });
      setTo('');
    } catch (err) {
      toast(err.message || 'Couldn’t send', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ink-3">Send a test text to</span>
      <input className="input h-8 w-44" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Your mobile" inputMode="tel" aria-label="Test text number" />
      <button className="btn-secondary btn-sm" disabled={!e164(to) || busy}>
        {busy ? <Spinner size={13} /> : <Send size={13} />} Send test
      </button>
    </form>
  );
}
