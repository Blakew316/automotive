import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText, Plus, X, ChevronDown, ChevronUp, Trash2, Send, CheckCircle,
  Clock, PlayCircle, Edit3, DollarSign
} from 'lucide-react';

const statusConfig = {
  draft: { label: 'Draft', badge: 'badge-gray', icon: Edit3 },
  pending: { label: 'Pending', badge: 'badge-yellow', icon: Clock },
  approved: { label: 'Approved', badge: 'badge-blue', icon: CheckCircle },
  in_progress: { label: 'In Progress', badge: 'badge-blue', icon: PlayCircle },
  completed: { label: 'Completed', badge: 'badge-green', icon: CheckCircle },
};

export default function Estimates() {
  const { estimates, customers, vehicles, addEstimate, updateEstimateStatus } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ customerId: '', vehicleId: '', notes: '', items: [{ description: '', partsCost: '', laborCost: '', qty: 1 }] });

  const filtered = filter === 'all' ? estimates : estimates.filter(e => e.status === filter);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', partsCost: '', laborCost: '', qty: 1 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }));

  const customerVehicles = form.customerId ? vehicles.filter(v => v.customerId === form.customerId) : [];

  const handleCreate = () => {
    if (!form.customerId || !form.vehicleId || form.items.length === 0) return;
    addEstimate({
      customerId: form.customerId,
      vehicleId: form.vehicleId,
      notes: form.notes,
      items: form.items.map(i => ({
        description: i.description,
        partsCost: parseFloat(i.partsCost) || 0,
        laborCost: parseFloat(i.laborCost) || 0,
        qty: parseInt(i.qty) || 1,
      })),
    });
    setForm({ customerId: '', vehicleId: '', notes: '', items: [{ description: '', partsCost: '', laborCost: '', qty: 1 }] });
    setShowCreate(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates & Work Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Create, manage, and track estimates for your customers.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus size={16} /> New Estimate
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Create New Estimate</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm(f => ({ ...f, customerId: e.target.value, vehicleId: '' }))}
                className="input-field"
              >
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
              <select
                value={form.vehicleId}
                onChange={(e) => setForm(f => ({ ...f, vehicleId: e.target.value }))}
                className="input-field"
                disabled={!form.customerId}
              >
                <option value="">Select vehicle...</option>
                {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="input-field flex-1" />
                  <input type="number" placeholder="Parts $" value={item.partsCost} onChange={(e) => updateItem(i, 'partsCost', e.target.value)} className="input-field w-28" step="0.01" min="0" />
                  <input type="number" placeholder="Labor $" value={item.laborCost} onChange={(e) => updateItem(i, 'laborCost', e.target.value)} className="input-field w-28" step="0.01" min="0" />
                  <input type="number" placeholder="Qty" value={item.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} className="input-field w-16" min="1" />
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 mt-2"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <Plus size={14} /> Add line item
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field" rows={2} placeholder="Any notes about this estimate..." />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary">Create Estimate</button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {['all', 'draft', 'pending', 'approved', 'in_progress', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Estimates List */}
      <div className="space-y-3">
        {filtered.map((est) => {
          const customer = customers.find(c => c.id === est.customerId);
          const vehicle = vehicles.find(v => v.id === est.vehicleId);
          const total = est.items.reduce((s, i) => s + (i.partsCost + i.laborCost) * i.qty, 0);
          const partsTotal = est.items.reduce((s, i) => s + i.partsCost * i.qty, 0);
          const laborTotal = est.items.reduce((s, i) => s + i.laborCost * i.qty, 0);
          const config = statusConfig[est.status] || statusConfig.draft;
          const isExpanded = expanded === est.id;

          return (
            <div key={est.id} className="card">
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors rounded-xl"
                onClick={() => setExpanded(isExpanded ? null : est.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{est.id}</span>
                      <span className={`badge ${config.badge}`}>{config.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {customer?.name} - {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'N/A'} - {est.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-gray-900">${total.toFixed(2)}</span>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <table className="w-full mb-4">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left py-2">Description</th>
                        <th className="text-right py-2">Parts</th>
                        <th className="text-right py-2">Labor</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {est.items.map((item, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="py-2 text-gray-900">{item.description}</td>
                          <td className="py-2 text-right text-gray-600">${item.partsCost.toFixed(2)}</td>
                          <td className="py-2 text-right text-gray-600">${item.laborCost.toFixed(2)}</td>
                          <td className="py-2 text-right text-gray-600">{item.qty}</td>
                          <td className="py-2 text-right font-medium">${((item.partsCost + item.laborCost) * item.qty).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between items-start">
                    <div>
                      {est.notes && <p className="text-xs text-gray-500 italic">Note: {est.notes}</p>}
                    </div>
                    <div className="text-right text-sm space-y-1">
                      <div className="text-gray-500">Parts: <span className="font-medium text-gray-900">${partsTotal.toFixed(2)}</span></div>
                      <div className="text-gray-500">Labor: <span className="font-medium text-gray-900">${laborTotal.toFixed(2)}</span></div>
                      <div className="text-gray-500 border-t border-gray-200 pt-1">
                        Tax (8.25%): <span className="font-medium text-gray-900">${(total * 0.0825).toFixed(2)}</span>
                      </div>
                      <div className="text-base font-bold text-gray-900">Total: ${(total * 1.0825).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    {est.status === 'draft' && (
                      <button onClick={() => updateEstimateStatus(est.id, 'pending')} className="btn-primary text-sm">
                        <Send size={14} /> Send to Customer
                      </button>
                    )}
                    {est.status === 'pending' && (
                      <button onClick={() => updateEstimateStatus(est.id, 'approved')} className="btn-success text-sm">
                        <CheckCircle size={14} /> Approve
                      </button>
                    )}
                    {est.status === 'approved' && (
                      <button onClick={() => updateEstimateStatus(est.id, 'in_progress')} className="btn-primary text-sm">
                        <PlayCircle size={14} /> Start Work
                      </button>
                    )}
                    {est.status === 'in_progress' && (
                      <>
                        <button onClick={() => updateEstimateStatus(est.id, 'completed')} className="btn-success text-sm">
                          <CheckCircle size={14} /> Complete
                        </button>
                      </>
                    )}
                    {(est.status === 'approved' || est.status === 'completed') && (
                      <button className="btn-secondary text-sm">
                        <DollarSign size={14} /> Create Invoice
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <FileText size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No estimates found</p>
            <p className="text-gray-400 text-sm mt-1">Create your first estimate to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
