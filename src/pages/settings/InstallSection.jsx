import { Smartphone, Download, CircleCheck, Share, SquarePlus, EllipsisVertical } from 'lucide-react';
import { useInstallPrompt, isStandalone, isIos } from '../../lib/pwa';
import { useUI } from '../../store/hooks';
import Section from './Section';
import { PRODUCT } from '../../brand/artwork';

/** Install WPI Driveline Shop Management System on phones, tablets and computers (home screen / dock app). */
export default function InstallSection() {
  const { canInstall, install } = useInstallPrompt();
  const { toast } = useUI();
  const installed = isStandalone();
  return (
    <Section id="install" icon={Smartphone} title="Mobile & desktop app" subtitle={`Install ${PRODUCT} on iPhone, iPad, Android, Mac or PC — opens full-screen and works offline`}>
      {installed ? (
        <p className="flex items-center gap-2 text-sm text-ok">
          <CircleCheck size={16} /> You’re using the installed app.
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          {canInstall && (
            <button
              className="btn-primary"
              onClick={async () => {
                const outcome = await install();
                if (outcome === 'accepted') toast(`${PRODUCT} installed`, { tone: 'success' });
              }}
            >
              <Download size={15} /> Install the app
            </button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`rounded-[10px] border p-3 ${isIos() ? 'border-accent/40' : 'border-line'}`}>
              <div className="mb-1.5 font-semibold">iPhone & iPad</div>
              <ol className="list-decimal space-y-1 pl-4 text-ink-2">
                <li>Open this page in Safari.</li>
                <li>
                  Tap <Share size={13} className="inline" /> Share.
                </li>
                <li>
                  Choose <SquarePlus size={13} className="inline" /> <b>Add to Home Screen</b>.
                </li>
              </ol>
            </div>
            <div className={`rounded-[10px] border p-3 ${!isIos() ? 'border-accent/40' : 'border-line'}`}>
              <div className="mb-1.5 font-semibold">Android, Chrome & Edge</div>
              <ol className="list-decimal space-y-1 pl-4 text-ink-2">
                <li>
                  Open the browser menu <EllipsisVertical size={13} className="inline" />.
                </li>
                <li>
                  Choose <b>Install app</b> (or <b>Add to Home screen</b>).
                </li>
                <li>On a computer, use the install icon in the address bar.</li>
              </ol>
            </div>
          </div>
          <p className="text-xs text-ink-3">
            Each device keeps its own copy of the shop’s data. Use Shop Cloud for share links and the inbox, and Settings → Data to move a backup between devices.
          </p>
        </div>
      )}
    </Section>
  );
}
