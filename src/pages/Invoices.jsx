import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Receipt, Plus, X, Send, CreditCard, CheckCircle, Clock,
  AlertTriangle, FileText, DollarSign, Printer, Mail
} from 'lucide-react';

const statusConfig = {
  draft: { label: 'Draft', badge: 'badge-gray', icon: FileText },
  sent: { label: 'Sent', badge: 'badge-blue', icon: Send },
  paid: { label: 'Paid', badge: 'badge-green', icon: CheckCircle },
  overdue: { label: 'Overdue', badge: 'badge-red', icon: AlertTriangle },
};

export default function Invoices() {
  const { invoices, customers, vehicles, estimates, addInvoice, updateInvoiceStatus } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [form, setForm] = useState({ customerId: '', vehicleId: '', estimateId: '', subtotal: '' });

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);

  const totalOutstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);

  const handleCreate = () => {
    if (!form.customerId || !form.subtotal) return;
    addInvoice({
      customerId: form.customerId,
      vehicleId: form.vehicleId || null,
      estimateId: form.estimateId || null,
      subtotal: parseFloat(form.subtotal),
    });
    setForm({ customerId: '', vehicleId: '', estimateId: '', subtotal: '' });
    setShowCreate(false);
  };

  const customerVehicles = form.customerId ? vehicles.filter(v => v.customerId === form.customerId) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage invoices. Send them directly to customers.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Collected</p>
              <p className="text-xl font-bold text-gray-900">${totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Outstanding</p>
              <p className="text-xl font-bold text-gray-900">${totalOutstanding.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Receipt size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Invoices</p>
              <p className="text-xl font-bold text-gray-900">{invoices.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Create New Invoice</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select value={form.customerId} onChange={(e) => setForm(f => ({ ...f, customerId: e.target.value, vehicleId: '' }))} className="input-field">
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle (optional)</label>
              <select value={form.vehicleId} onChange={(e) => setForm(f => ({ ...f, vehicleId: e.target.value }))} className="input-field" disabled={!form.customerId}>
                <option value="">Select vehicle...</option>
                {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link to Estimate (optional)</label>
              <select value={form.estimateId} onChange={(e) => setForm(f => ({ ...f, estimateId: e.target.value }))} className="input-field">
                <option value="">No estimate</option>
                {estimates.filter(e => e.customerId === form.customerId).map(e => <option key={e.id} value={e.id}>{e.id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal ($)</label>
              <input type="number" value={form.subtotal} onChange={(e) => setForm(f => ({ ...f, subtotal: e.target.value }))} className="input-field" placeholder="0.00" step="0.01" min="0" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary">Create Invoice</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' && `(${invoices.filter(i => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header">Invoice</th>
              <th className="table-header">Customer</th>
              <th className="table-header">Vehicle</th>
              <th className="table-header">Date</th>
              <th className="table-header">Due</th>
              <th className="table-header">Amount</th>
              <th className="table-header">Status</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(inv => {
              const customer = customers.find(c => c.id === inv.customerId);
              const vehicle = vehicles.find(v => v.id === inv.vehicleId);
              const config = statusConfig[inv.status] || statusConfig.draft;
              return (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="table-cell font-semibold text-gray-900">{inv.id}</td>
                  <td className="table-cell">{customer?.name || 'Unknown'}</td>
                  <td className="table-cell text-xs">{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '-'}</td>
                  <td className="table-cell text-xs">{inv.issueDate}</td>
                  <td className="table-cell text-xs">{inv.dueDate}</td>
                  <td className="table-cell font-semibold">${inv.total.toFixed(2)}</td>
                  <td className="table-cell"><span className={`badge ${config.badge}`}>{config.label}</span></td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      {inv.status === 'draft' && (
                        <button onClick={() => updateInvoiceStatus(inv.id, 'sent')} className="text-blue-600 hover:text-blue-700 p-1" title="Send invoice">
                          <Send size={14} />
                        </button>
                      )}
                      {(inv.status === 'sent' || inv.status === 'overdue') && (
                        <button onClick={() => updateInvoiceStatus(inv.id, 'paid', 'Credit Card')} className="text-emerald-600 hover:text-emerald-700 p-1" title="Mark as paid">
                          <CreditCard size={14} />
                        </button>
                      )}
                      <button className="text-gray-400 hover:text-gray-600 p-1" title="Print">
                        <Printer size={14} />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600 p-1" title="Email">
                        <Mail size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Receipt size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No invoices found</p>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Invoice {selectedInvoice.id}</h2>
            <button onClick={() => setSelectedInvoice(null)} className="btn-secondary">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
