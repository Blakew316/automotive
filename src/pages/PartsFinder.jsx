import { useState } from 'react';
import { partsCatalog, partsCategories, vinDatabase } from '../data/sampleData';
import {
  Package, Search, Filter, ShoppingCart, Plus, Check,
  Disc, Cog, Zap, Wind, Thermometer, Settings, Car, Armchair, SlidersHorizontal
} from 'lucide-react';

const categoryIcons = {
  disc: Disc, cog: Cog, spring: SlidersHorizontal, zap: Zap, wind: Wind,
  thermometer: Thermometer, settings: Settings, car: Car, armchair: Armchair, filter: Filter,
};

export default function PartsFinder() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vinFilter, setVinFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState([]);
  const [vinInfo, setVinInfo] = useState(null);

  const handleVinSearch = () => {
    const clean = vinFilter.trim().toUpperCase();
    if (clean.length === 17 && vinDatabase[clean]) {
      setVinInfo(vinDatabase[clean]);
    } else {
      setVinInfo(null);
    }
  };

  let filtered = partsCatalog;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
  }
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(p => p.category === categoryFilter);
  }
  if (vinInfo) {
    filtered = filtered.filter(p => p.fits.some(f => f.toLowerCase().includes(vinInfo.model.toLowerCase()) || f === 'Universal'));
  }

  const addToCart = (part) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === part.id);
      if (existing) return prev.map(c => c.id === part.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...part, qty: 1 }];
    });
  };

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parts Finder</h1>
          <p className="text-gray-500 text-sm mt-1">Search parts by VIN, category, or keyword. Add to cart for estimates.</p>
        </div>
        {cartCount > 0 && (
          <div className="card px-4 py-2 flex items-center gap-3">
            <ShoppingCart size={18} className="text-blue-600" />
            <span className="text-sm font-medium">{cartCount} items</span>
            <span className="text-sm font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* VIN Search */}
      <div className="card p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by VIN (find compatible parts)</label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={vinFilter}
              onChange={(e) => setVinFilter(e.target.value.toUpperCase())}
              placeholder="Enter VIN to find compatible parts..."
              className="input-field pl-9 font-mono text-sm"
              maxLength={17}
              onKeyDown={(e) => e.key === 'Enter' && handleVinSearch()}
            />
          </div>
          <button onClick={handleVinSearch} className="btn-primary">
            <Search size={14} /> Search
          </button>
          {vinInfo && (
            <button onClick={() => { setVinFilter(''); setVinInfo(null); }} className="btn-secondary">
              Clear VIN
            </button>
          )}
        </div>
        {vinInfo && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Check size={16} className="text-emerald-500" />
            <span className="text-emerald-700 font-medium">
              Showing parts for: {vinInfo.year} {vinInfo.make} {vinInfo.model} {vinInfo.trim}
            </span>
          </div>
        )}
        {/* Quick VIN buttons */}
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(vinDatabase).slice(0, 4).map(([vin, info]) => (
            <button
              key={vin}
              onClick={() => { setVinFilter(vin); setVinInfo(info); }}
              className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-2 py-1 rounded transition-colors"
            >
              {info.year} {info.make} {info.model}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Category Sidebar */}
        <div className="w-48 shrink-0">
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Categories</h3>
            <button
              onClick={() => setCategoryFilter('all')}
              className={`w-full text-left px-2 py-1.5 rounded text-sm font-medium transition-colors ${categoryFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              All Parts ({partsCatalog.length})
            </button>
            {partsCategories.map(cat => {
              const Icon = categoryIcons[cat.icon] || Package;
              const count = partsCatalog.filter(p => p.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 ${categoryFilter === cat.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Icon size={14} />
                  {cat.name}
                  <span className="text-xs text-gray-400 ml-auto">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parts Grid */}
        <div className="flex-1">
          {/* Text Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by part name, number, or brand..."
              className="input-field pl-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(part => {
              const inCart = cart.find(c => c.id === part.id);
              return (
                <div key={part.id} className="card p-4 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{part.name}</h3>
                      <p className="text-xs font-mono text-gray-400 mt-0.5">{part.partNumber}</p>
                    </div>
                    <span className={`badge ${part.inStock > 5 ? 'badge-green' : part.inStock > 0 ? 'badge-yellow' : 'badge-red'}`}>
                      {part.inStock > 0 ? `${part.inStock} in stock` : 'Out of stock'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Brand: <span className="font-medium text-gray-700">{part.brand}</span></p>
                  <p className="text-xs text-gray-500 mb-3">Fits: {part.fits.join(', ')}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">${part.price.toFixed(2)}</span>
                    <button
                      onClick={() => addToCart(part)}
                      disabled={part.inStock === 0}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        inCart ? 'bg-emerald-100 text-emerald-700' : part.inStock > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {inCart ? <><Check size={12} /> Added ({inCart.qty})</> : <><Plus size={12} /> Add to Cart</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="card p-12 text-center">
              <Package size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No parts found</p>
              <p className="text-gray-400 text-sm mt-1">Try a different search or category filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Drawer */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 card p-4 w-80 shadow-xl">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ShoppingCart size={16} className="text-blue-600" /> Cart ({cartCount} items)
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 truncate text-xs font-medium">{item.name}</p>
                </div>
                <span className="text-xs text-gray-500 mx-2">x{item.qty}</span>
                <span className="font-medium text-xs">${(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Total: ${cartTotal.toFixed(2)}</span>
            <div className="flex gap-2">
              <button onClick={() => setCart([])} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
              <button className="btn-primary text-xs py-1.5">Add to Estimate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
