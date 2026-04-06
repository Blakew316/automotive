import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users, Plus, X, Search, Phone, Mail, MapPin,
  Car, DollarSign, ChevronDown, ChevronUp
} from 'lucide-react';

export default function Customers() {
  const { customers, vehicles, estimates, addCustomer } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });

  const filtered = searchQuery
    ? customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
      )
    : customers;

  const handleCreate = () => {
    if (!form.name) return;
    addCustomer({ ...form, vehicles: [] });
    setForm({ name: '', email: '', phone: '', address: '' });
    setShowCreate(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your customer database and view their service history.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Add New Customer</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="input-field" placeholder="john@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} className="input-field" placeholder="123 Main St, City, ST 12345" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary">Add Customer</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="input-field pl-9"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
          <p className="text-xs text-gray-500">Total Customers</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
          <p className="text-xs text-gray-500">Total Vehicles</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">${customers.reduce((s, c) => s + c.totalSpent, 0).toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total Revenue</p>
        </div>
      </div>

      {/* Customer Cards */}
      <div className="space-y-3">
        {filtered.map(customer => {
          const custVehicles = vehicles.filter(v => v.customerId === customer.id);
          const custEstimates = estimates.filter(e => e.customerId === customer.id);
          const isExpanded = expanded === customer.id;

          return (
            <div key={customer.id} className="card">
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-xl transition-colors"
                onClick={() => setExpanded(isExpanded ? null : customer.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                    {customer.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{customer.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1"><Mail size={12} /> {customer.email}</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">${customer.totalSpent.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{customer.visits} visits</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Car size={14} /> {custVehicles.length}
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Address */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contact Info</h4>
                      <div className="space-y-1 text-sm">
                        <p className="flex items-center gap-2 text-gray-700"><MapPin size={14} className="text-gray-400" /> {customer.address}</p>
                        <p className="flex items-center gap-2 text-gray-700"><Mail size={14} className="text-gray-400" /> {customer.email}</p>
                        <p className="flex items-center gap-2 text-gray-700"><Phone size={14} className="text-gray-400" /> {customer.phone}</p>
                      </div>
                    </div>

                    {/* Vehicles */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Vehicles</h4>
                      {custVehicles.length > 0 ? (
                        <div className="space-y-2">
                          {custVehicles.map(v => (
                            <div key={v.id} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg">
                              <Car size={14} className="text-gray-400" />
                              <span className="font-medium text-gray-900">{v.year} {v.make} {v.model}</span>
                              <span className="text-xs text-gray-400">{v.trim}</span>
                              <span className="text-xs text-gray-400 ml-auto">{v.mileage.toLocaleString()} mi</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No vehicles on file</p>
                      )}
                    </div>
                  </div>

                  {/* Service History */}
                  {custEstimates.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Service History</h4>
                      <div className="space-y-1">
                        {custEstimates.map(est => {
                          const v = vehicles.find(vh => vh.id === est.vehicleId);
                          const total = est.items.reduce((s, i) => s + (i.partsCost + i.laborCost) * i.qty, 0);
                          const statusColors = { draft: 'badge-gray', pending: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', completed: 'badge-green' };
                          return (
                            <div key={est.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-900">{est.id}</span>
                                <span className={`badge ${statusColors[est.status] || 'badge-gray'}`}>{est.status.replace('_', ' ')}</span>
                                <span className="text-gray-500 text-xs">{v ? `${v.year} ${v.make} ${v.model}` : ''}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">{est.date}</span>
                                <span className="font-semibold">${total.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <Users size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No customers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
