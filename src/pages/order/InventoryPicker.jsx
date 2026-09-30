import { useMemo, useState } from 'react';
import { Modal, SearchInput, Mono } from '../../components/ui';
import { useShop } from '../../store/hooks';
import { money } from '../../lib/format';
import { priceFromMatrix } from '../../lib/pricing';

export default function InventoryPicker({ onClose, onPick }) {
  const { state } = useShop();
  const [q, setQ] = useState('');
  const [qty, setQty] = useState(1);
  const rows = useMemo(() => {
    const query = q.toLowerCase();
    return state.inventory.filter((p) => !query || `${p.partNumber} ${p.brand} ${p.description} ${p.sku} ${p.category}`.toLowerCase().includes(query));
  }, [q, state.inventory]);

  return (
    <Modal open onClose={onClose} title="Add from inventory" subtitle="Pulls the part from stock and prices it from your markup matrix." size="lg">
      <div className="mb-3 flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Part number, brand, description" className="flex-1" autoFocus />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Qty
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="input w-16 text-right" />
        </label>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-line">
        <table className="table">
          <thead>
            <tr>
              <th>Part</th>
              <th className="hidden sm:table-cell">Location</th>
              <th className="text-right">On hand</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Sell</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={`row-link ${p.qty < qty ? 'opacity-50' : ''}`}
                onClick={() => {
                  onPick(p, qty);
                  onClose();
                }}
              >
                <td>
                  <div className="font-medium">{p.description}</div>
                  <div className="text-xs text-ink-3">
                    {p.brand} {p.partNumber && <Mono className="text-ink-2">{p.partNumber}</Mono>}
                  </div>
                </td>
                <td className="hidden text-ink-2 sm:table-cell">{p.location}</td>
                <td className="tabular text-right">{p.qty}</td>
                <td className="tabular text-right text-ink-2">{money(p.cost)}</td>
                <td className="tabular text-right">{money(priceFromMatrix(p.cost, state.shop.matrix))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="p-8 text-center text-sm text-ink-3">No parts match “{q}”.</div>}
      </div>
    </Modal>
  );
}
