import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { vinDatabase, partsCatalog, wiringDiagrams, serviceManuals } from '../data/sampleData';
import { Link } from 'react-router-dom';
import {
  Search, Car, Cpu, Fuel, Gauge, MapPin, Globe,
  Package, BookOpen, FileText, ArrowRight, Info, CheckCircle, AlertTriangle
} from 'lucide-react';

export default function VinLookup() {
  const { vehicles, addVehicle, addNotification } = useApp();
  const [vin, setVin] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const sampleVins = Object.keys(vinDatabase);

  const handleLookup = () => {
    setError('');
    setResult(null);
    const cleanVin = vin.trim().toUpperCase();
    if (cleanVin.length !== 17) {
      setError('VIN must be exactly 17 characters.');
      return;
    }
    setSearching(true);
    setTimeout(() => {
      const found = vinDatabase[cleanVin];
      if (found) {
        const matchingParts = partsCatalog.filter(p =>
          p.fits.some(f => f.toLowerCase().includes(found.model.toLowerCase()))
        );
        const matchingDiagrams = wiringDiagrams.filter(w =>
          w.vehicle.toLowerCase().includes(found.model.toLowerCase())
        );
        const matchingManuals = serviceManuals.filter(m =>
          m.vehicle.toLowerCase().includes(found.model.toLowerCase())
        );
        setResult({ ...found, vin: cleanVin, matchingParts, matchingDiagrams, matchingManuals });
      } else {
        setError('VIN not found in database. Try one of the sample VINs below.');
      }
      setSearching(false);
    }, 800);
  };

  const handleAddVehicle = () => {
    if (!result) return;
    const exists = vehicles.find(v => v.vin === result.vin);
    if (exists) {
      addNotification('This vehicle is already in the system', 'info');
      return;
    }
    addVehicle({
      vin: result.vin,
      year: result.year,
      make: result.make,
      model: result.model,
      trim: result.trim,
      engine: result.engine,
      transmission: result.transmission,
      color: '',
      mileage: 0,
      plate: '',
      customerId: null,
    });
  };

  const specs = result ? [
    { icon: Car, label: 'Body Style', value: result.bodyStyle },
    { icon: Cpu, label: 'Engine', value: result.engine },
    { icon: Gauge, label: 'Transmission', value: result.transmission },
    { icon: Car, label: 'Drivetrain', value: result.drivetrain },
    { icon: Fuel, label: 'Fuel Type', value: result.fuelType },
    { icon: MapPin, label: 'Plant', value: result.manufacturingPlant },
    { icon: Globe, label: 'Country', value: result.country },
  ] : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">VIN Lookup</h1>
        <p className="text-gray-500 text-sm mt-1">Decode any VIN to get vehicle specs, find compatible parts, and access wiring diagrams.</p>
      </div>

      {/* Search Box */}
      <div className="card p-6 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="Enter 17-character VIN number..."
              className="input-field pl-10 font-mono text-sm tracking-wider"
              maxLength={17}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            />
          </div>
          <button onClick={handleLookup} disabled={searching} className="btn-primary">
            {searching ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Decoding...</span>
            ) : (
              <><Search size={16} /> Decode VIN</>
            )}
          </button>
        </div>
        {vin.length > 0 && vin.length < 17 && (
          <p className="text-xs text-gray-400 mt-2">{17 - vin.length} characters remaining</p>
        )}
        {error && (
          <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Sample VINs */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Sample VINs to try:</p>
          <div className="flex flex-wrap gap-2">
            {sampleVins.map(v => (
              <button
                key={v}
                onClick={() => { setVin(v); setError(''); setResult(null); }}
                className="text-xs font-mono bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-2 py-1 rounded transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Vehicle Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={18} className="text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">VIN Decoded Successfully</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {result.year} {result.make} {result.model}
                </h2>
                <p className="text-gray-500">{result.trim}</p>
                <p className="text-xs font-mono text-gray-400 mt-2">{result.vin}</p>
              </div>
              <button onClick={handleAddVehicle} className="btn-primary">
                <Car size={16} /> Add to Vehicles
              </button>
            </div>
          </div>

          {/* Specifications */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Info size={18} /> Vehicle Specifications
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
              {specs.map((spec, i) => (
                <div key={spec.label} className={`px-6 py-4 flex items-center gap-3 ${i < specs.length - (specs.length % 3 || 3) ? 'border-b' : ''} border-gray-50`}>
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <spec.icon size={16} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{spec.label}</p>
                    <p className="text-sm font-medium text-gray-900">{spec.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compatible Parts */}
          {result.matchingParts.length > 0 && (
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package size={18} /> Compatible Parts ({result.matchingParts.length})
                </h3>
                <Link to="/parts" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View all parts <ArrowRight size={14} />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-header">Part</th>
                      <th className="table-header">Part #</th>
                      <th className="table-header">Brand</th>
                      <th className="table-header">Price</th>
                      <th className="table-header">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.matchingParts.map(part => (
                      <tr key={part.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium text-gray-900">{part.name}</td>
                        <td className="table-cell font-mono text-xs">{part.partNumber}</td>
                        <td className="table-cell">{part.brand}</td>
                        <td className="table-cell font-semibold">${part.price.toFixed(2)}</td>
                        <td className="table-cell">
                          <span className={`badge ${part.inStock > 5 ? 'badge-green' : part.inStock > 0 ? 'badge-yellow' : 'badge-red'}`}>
                            {part.inStock} in stock
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Wiring & Manuals */}
          {(result.matchingDiagrams.length > 0 || result.matchingManuals.length > 0) && (
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BookOpen size={18} /> Wiring Diagrams & Manuals
                </h3>
                <Link to="/manuals" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  Browse library <ArrowRight size={14} />
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {result.matchingDiagrams.map(d => (
                  <div key={d.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                        <FileText size={16} className="text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.title}</p>
                        <p className="text-xs text-gray-500">{d.pages} pages - {d.size}</p>
                      </div>
                    </div>
                    <span className="badge badge-blue">{d.category}</span>
                  </div>
                ))}
                {result.matchingManuals.map(m => (
                  <div key={m.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                        <BookOpen size={16} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.title}</p>
                        <p className="text-xs text-gray-500">{m.pages} pages - {m.size}</p>
                      </div>
                    </div>
                    <span className="badge badge-green">{m.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
