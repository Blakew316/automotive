import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import {
  Car, Search, Plus, X, ChevronDown, ChevronUp,
  Gauge, Fuel, Calendar, Hash, Palette
} from 'lucide-react';

export default function Vehicles() {
  const { vehicles, customers, estimates, addVehicle } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customerId: '', vin: '', year: '', make: '', model: '', trim: '', engine: '', transmission: '', color: '', mileage: '', plate: '' });

  const filtered = searchQuery
    ? vehicles.filter(v =>
        `${v.year} ${v.make} ${v.model} ${v.trim} ${v.vin} ${v.plate}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : vehicles;

  const handleCreate = () => {
    if (!form.make || !form.model || !form.year) return;
    addVehicle({
      ...form,
      year: parseInt(form.year),
      mileage: parseInt(form.mileage) || 0,
      customerId: form.customerId || null,
    });
    setForm({ customerId: '', vin: '', year: '', make: '', model: '', trim: '', engine: '', transmission: '', color: '', mileage: '', plate: '' });
    setShowCreate(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 text-sm mt-1">Browse and manage all vehicles in your system.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/vin-lookup" className="btn-secondary"><Search size={16} /> VIN Lookup</Link>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary"><Plus size={16} /> Add Vehicle</button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Add New Vehicle</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <select value={form.customerId} onChange={(e) => setForm(f => ({ ...f, customerId: e.target.value }))} className="input-field">
                <option value="">No owner assigned</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
              <input type="text" value={form.vin} onChange={(e) => setForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))} className="input-field font-mono" placeholder="17-character VIN" maxLength={17} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
              <input type="text" value={form.plate} onChange={(e) => setForm(f => ({ ...f, plate: e.target.value }))} className="input-field" placeholder="ABC-1234" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))} className="input-field" placeholder="2024" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
              <input type="text" value={form.make} onChange={(e) => setForm(f => ({ ...f, make: e.target.value }))} className="input-field" placeholder="Honda" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input type="text" value={form.model} onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))} className="input-field" placeholder="Accord" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trim</label>
              <input type="text" value={form.trim} onChange={(e) => setForm(f => ({ ...f, trim: e.target.value }))} className="input-field" placeholder="EX-L" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Engine</label>
              <input type="text" value={form.engine} onChange={(e) => setForm(f => ({ ...f, engine: e.target.value }))} className="input-field" placeholder="2.0L Turbo I4" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input type="text" value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))} className="input-field" placeholder="Silver" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
              <input type="number" value={form.mileage} onChange={(e) => setForm(f => ({ ...f, mileage: e.target.value }))} className="input-field" placeholder="25000" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary">Add Vehicle</button>
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
          placeholder="Search by year, make, model, VIN, or plate..."
          className="input-field pl-9"
        />
      </div>

      {/* Vehicle Cards */}
      <div className="space-y-3">
        {filtered.map(vehicle => {
          const owner = customers.find(c => c.id === vehicle.customerId);
          const vehicleEstimates = estimates.filter(e => e.vehicleId === vehicle.id);
          const isExpanded = expanded === vehicle.id;

          return (
            <div key={vehicle.id} className="card">
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-xl transition-colors"
                onClick={() => setExpanded(isExpanded ? null : vehicle.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Car size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      <span className="text-gray-400 font-normal ml-1">{vehicle.trim}</span>
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="font-mono">{vehicle.vin}</span>
                      {vehicle.plate && <span className="badge badge-gray">{vehicle.plate}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {owner && <span className="text-xs text-gray-500">{owner.name}</span>}
                  <span className="text-sm text-gray-700">{vehicle.mileage.toLocaleString()} mi</span>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Gauge size={14} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Engine</p>
                        <p className="font-medium text-gray-900">{vehicle.engine || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={14} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Transmission</p>
                        <p className="font-medium text-gray-900">{vehicle.transmission || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Palette size={14} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Color</p>
                        <p className="font-medium text-gray-900">{vehicle.color || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Hash size={14} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Plate</p>
                        <p className="font-medium text-gray-900">{vehicle.plate || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  {owner && (
                    <div className="mb-3 text-sm">
                      <span className="text-gray-500">Owner: </span>
                      <span className="font-medium text-gray-900">{owner.name}</span>
                      <span className="text-gray-400 ml-2">{owner.phone}</span>
                    </div>
                  )}
                  {vehicleEstimates.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Service History</h4>
                      <div className="space-y-1">
                        {vehicleEstimates.map(est => {
                          const total = est.items.reduce((s, i) => s + (i.partsCost + i.laborCost) * i.qty, 0);
                          const statusColors = { draft: 'badge-gray', pending: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', completed: 'badge-green' };
                          return (
                            <div key={est.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{est.id}</span>
                                <span className={`badge ${statusColors[est.status] || 'badge-gray'}`}>{est.status.replace('_', ' ')}</span>
                                <span className="text-gray-500 text-xs">{est.items[0]?.description}</span>
                              </div>
                              <span className="font-semibold">${total.toFixed(2)}</span>
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
            <Car size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No vehicles found</p>
          </div>
        )}
      </div>
    </div>
  );
}
