import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, Search, FileText, Receipt, Package, BookOpen,
  Users, Car, Settings, ChevronLeft, ChevronRight, X, CheckCircle,
  AlertCircle, Info, Wrench
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vin-lookup', icon: Search, label: 'VIN Lookup' },
  { to: '/estimates', icon: FileText, label: 'Estimates' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/parts', icon: Package, label: 'Parts Finder' },
  { to: '/manuals', icon: BookOpen, label: 'Manuals & Wiring' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/vehicles', icon: Car, label: 'Vehicles' },
];

function NotificationToast({ notification, onDismiss }) {
  const icons = { success: CheckCircle, error: AlertCircle, info: Info };
  const colors = { success: 'bg-emerald-50 border-emerald-200 text-emerald-800', error: 'bg-red-50 border-red-200 text-red-800', info: 'bg-blue-50 border-blue-200 text-blue-800' };
  const Icon = icons[notification.type] || Info;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${colors[notification.type] || colors.info}`}>
      <Icon size={18} />
      <span className="text-sm font-medium flex-1">{notification.message}</span>
      <button onClick={() => onDismiss(notification.id)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

export default function Layout() {
  const { notifications } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 shrink-0`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-gray-200`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wrench size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-tight">AutoShop Pro</h1>
                <p className="text-[10px] text-gray-500 leading-tight">Shop Management</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wrench size={18} className="text-white" />
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${collapsed ? 'justify-center px-2' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={20} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-gray-200">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-link sidebar-link-inactive w-full justify-center"
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {notifications.map(n => (
            <NotificationToast key={n.id} notification={n} onDismiss={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
