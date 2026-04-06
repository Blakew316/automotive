import { useState } from 'react';
import { wiringDiagrams, serviceManuals, vinDatabase } from '../data/sampleData';
import {
  BookOpen, FileText, Search, Download, Eye, Zap,
  Filter, Check, ChevronDown
} from 'lucide-react';

export default function Manuals() {
  const [activeTab, setActiveTab] = useState('wiring');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [vinSearch, setVinSearch] = useState('');
  const [vinInfo, setVinInfo] = useState(null);

  const allVehicles = [...new Set([...wiringDiagrams.map(d => d.vehicle), ...serviceManuals.map(m => m.vehicle)])];
  const data = activeTab === 'wiring' ? wiringDiagrams : serviceManuals;

  const allCategories = [...new Set(data.map(d => d.category))];

  const handleVinSearch = () => {
    const clean = vinSearch.trim().toUpperCase();
    if (clean.length === 17 && vinDatabase[clean]) {
      const info = vinDatabase[clean];
      setVinInfo(info);
      const matchingVehicle = allVehicles.find(v => v.toLowerCase().includes(info.model.toLowerCase()));
      if (matchingVehicle) setVehicleFilter(matchingVehicle);
    }
  };

  let filtered = data;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(d => d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  }
  if (vehicleFilter !== 'all') {
    filtered = filtered.filter(d => d.vehicle === vehicleFilter);
  }
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(d => d.category === categoryFilter);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wiring Diagrams & Service Manuals</h1>
        <p className="text-gray-500 text-sm mt-1">Access wiring catalogs, service manuals, and technical documentation by vehicle.</p>
      </div>

      {/* VIN Quick Search */}
      <div className="card p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Find documentation by VIN</label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={vinSearch}
              onChange={(e) => setVinSearch(e.target.value.toUpperCase())}
              placeholder="Enter VIN to find matching manuals and wiring diagrams..."
              className="input-field pl-9 font-mono text-sm"
              maxLength={17}
              onKeyDown={(e) => e.key === 'Enter' && handleVinSearch()}
            />
          </div>
          <button onClick={handleVinSearch} className="btn-primary"><Search size={14} /> Find Docs</button>
          {vinInfo && (
            <button onClick={() => { setVinSearch(''); setVinInfo(null); setVehicleFilter('all'); }} className="btn-secondary">Clear</button>
          )}
        </div>
        {vinInfo && (
          <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700">
            <Check size={16} /> Showing docs for: {vinInfo.year} {vinInfo.make} {vinInfo.model} {vinInfo.trim}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(vinDatabase).slice(0, 5).map(([vin, info]) => (
            <button
              key={vin}
              onClick={() => {
                setVinSearch(vin);
                setVinInfo(info);
                const match = allVehicles.find(v => v.toLowerCase().includes(info.model.toLowerCase()));
                if (match) setVehicleFilter(match);
              }}
              className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-2 py-1 rounded transition-colors"
            >
              {info.year} {info.make} {info.model}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setActiveTab('wiring'); setCategoryFilter('all'); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'wiring' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Zap size={14} /> Wiring Diagrams ({wiringDiagrams.length})
        </button>
        <button
          onClick={() => { setActiveTab('manuals'); setCategoryFilter('all'); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'manuals' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BookOpen size={14} /> Service Manuals ({serviceManuals.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or category..."
            className="input-field pl-9"
          />
        </div>
        <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Vehicles</option>
          {allVehicles.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <div key={doc.id} className="card p-5 hover:border-blue-200 hover:shadow-md transition-all group">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${activeTab === 'wiring' ? 'bg-orange-50' : 'bg-purple-50'}`}>
                {activeTab === 'wiring' ? <Zap size={18} className="text-orange-600" /> : <BookOpen size={18} className="text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{doc.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{doc.vehicle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
              <span className="badge badge-blue">{doc.category}</span>
              <span>{doc.pages} pages</span>
              <span>{doc.format}</span>
              <span>{doc.size}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary text-xs py-1.5 flex-1">
                <Eye size={12} /> View
              </button>
              <button className="btn-secondary text-xs py-1.5 flex-1">
                <Download size={12} /> Download
              </button>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No documents found</p>
          <p className="text-gray-400 text-sm mt-1">Try a different search or filter.</p>
        </div>
      )}
    </div>
  );
}
