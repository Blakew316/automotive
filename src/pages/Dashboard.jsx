import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import {
  DollarSign, FileText, Users, Car, TrendingUp, Clock,
  ArrowRight, CreditCard, UserPlus, CheckCircle, Package, Send
} from 'lucide-react';
import { recentActivity } from '../data/sampleData';

const activityIcons = {
  'file-text': FileText,
  'credit-card': CreditCard,
  'car': Car,
  'check-circle': CheckCircle,
  'user-plus': UserPlus,
  'package': Package,
  'send': Send,
};

const activityColors = {
  estimate: 'bg-blue-100 text-blue-600',
  invoice: 'bg-emerald-100 text-emerald-600',
  vehicle: 'bg-purple-100 text-purple-600',
  customer: 'bg-amber-100 text-amber-600',
  parts: 'bg-orange-100 text-orange-600',
};

export default function Dashboard() {
  const { customers, vehicles, estimates, invoices } = useApp();

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const activeEstimates = estimates.filter(e => e.status !== 'completed');
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const stats = [
    { label: 'Monthly Revenue', value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: DollarSign, change: '+12.5%', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Estimates', value: activeEstimates.length, icon: FileText, change: `${estimates.length} total`, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending Invoices', value: pendingInvoices.length, icon: Clock, change: overdueCount > 0 ? `${overdueCount} overdue` : 'All on time', color: overdueCount > 0 ? 'text-red-600' : 'text-amber-600', bg: overdueCount > 0 ? 'bg-red-50' : 'bg-amber-50' },
    { label: 'Customers', value: customers.length, icon: Users, change: `${vehicles.length} vehicles`, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const quickActions = [
    { label: 'VIN Lookup', to: '/vin-lookup', icon: Car, desc: 'Decode a VIN number' },
    { label: 'New Estimate', to: '/estimates', icon: FileText, desc: 'Create a work order' },
    { label: 'Find Parts', to: '/parts', icon: Package, desc: 'Search by VIN' },
    { label: 'Send Invoice', to: '/invoices', icon: Send, desc: 'Bill a customer' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back. Here's what's happening at your shop.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{stat.label}</span>
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={20} className={stat.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className={`text-xs mt-1 ${stat.color} font-medium flex items-center gap-1`}>
              <TrendingUp size={12} />
              {stat.change}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="card p-4 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
              <action.icon size={20} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{action.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <span className="text-xs text-gray-400">Last 7 days</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((item) => {
              const Icon = activityIcons[item.icon] || FileText;
              return (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${activityColors[item.type] || 'bg-gray-100 text-gray-600'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.action}</p>
                    <p className="text-xs text-gray-500 truncate">{item.detail}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{item.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Estimates Overview */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Active Estimates</h2>
            <Link to="/estimates" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {activeEstimates.map((est) => {
              const vehicle = vehicles.find(v => v.id === est.vehicleId);
              const customer = customers.find(c => c.id === est.customerId);
              const total = est.items.reduce((s, i) => s + (i.partsCost + i.laborCost) * i.qty, 0);
              const statusColors = { draft: 'badge-gray', pending: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', completed: 'badge-green' };
              return (
                <div key={est.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{est.id}</span>
                      <span className={`badge ${statusColors[est.status] || 'badge-gray'}`}>
                        {est.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {customer?.name} - {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">${total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
