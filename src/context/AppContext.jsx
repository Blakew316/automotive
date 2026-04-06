import { createContext, useContext, useState, useCallback } from 'react';
import { customers as initialCustomers, vehicles as initialVehicles, estimates as initialEstimates, invoices as initialInvoices } from '../data/sampleData';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [estimates, setEstimates] = useState(initialEstimates);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const getCustomer = useCallback((id) => customers.find(c => c.id === id), [customers]);
  const getVehicle = useCallback((id) => vehicles.find(v => v.id === id), [vehicles]);
  const getVehiclesByCustomer = useCallback((customerId) => vehicles.filter(v => v.customerId === customerId), [vehicles]);
  const getEstimatesByCustomer = useCallback((customerId) => estimates.filter(e => e.customerId === customerId), [estimates]);
  const getEstimatesByVehicle = useCallback((vehicleId) => estimates.filter(e => e.vehicleId === vehicleId), [estimates]);

  const addCustomer = useCallback((customer) => {
    const newCustomer = { ...customer, id: `C${String(customers.length + 1).padStart(3, '0')}`, totalSpent: 0, visits: 0 };
    setCustomers(prev => [...prev, newCustomer]);
    addNotification(`Customer "${customer.name}" added successfully`);
    return newCustomer;
  }, [customers.length, addNotification]);

  const addVehicle = useCallback((vehicle) => {
    const newVehicle = { ...vehicle, id: `V${String(vehicles.length + 1).padStart(3, '0')}` };
    setVehicles(prev => [...prev, newVehicle]);
    addNotification(`Vehicle ${vehicle.year} ${vehicle.make} ${vehicle.model} added`);
    return newVehicle;
  }, [vehicles.length, addNotification]);

  const addEstimate = useCallback((estimate) => {
    const newEstimate = { ...estimate, id: `EST-${String(estimates.length + 1).padStart(3, '0')}`, status: 'draft', date: new Date().toISOString().split('T')[0] };
    setEstimates(prev => [...prev, newEstimate]);
    addNotification(`Estimate ${newEstimate.id} created`);
    return newEstimate;
  }, [estimates.length, addNotification]);

  const updateEstimateStatus = useCallback((id, status) => {
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    addNotification(`Estimate ${id} marked as ${status}`);
  }, [addNotification]);

  const addInvoice = useCallback((invoice) => {
    const subtotal = invoice.subtotal || 0;
    const tax = subtotal * 0.0825;
    const newInvoice = {
      ...invoice,
      id: `INV-${String(invoices.length + 1).padStart(3, '0')}`,
      status: 'draft',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      paidDate: null,
      paymentMethod: null,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
    setInvoices(prev => [...prev, newInvoice]);
    addNotification(`Invoice ${newInvoice.id} created`);
    return newInvoice;
  }, [invoices.length, addNotification]);

  const updateInvoiceStatus = useCallback((id, status, paymentMethod) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== id) return inv;
      const updates = { status };
      if (status === 'paid') {
        updates.paidDate = new Date().toISOString().split('T')[0];
        updates.paymentMethod = paymentMethod || 'Credit Card';
      }
      if (status === 'sent') {
        addNotification(`Invoice ${id} sent to customer`);
      }
      return { ...inv, ...updates };
    }));
    if (status === 'paid') addNotification(`Invoice ${id} marked as paid`);
  }, [addNotification]);

  const value = {
    customers, vehicles, estimates, invoices, notifications,
    getCustomer, getVehicle, getVehiclesByCustomer, getEstimatesByCustomer, getEstimatesByVehicle,
    addCustomer, addVehicle, addEstimate, updateEstimateStatus, addInvoice, updateInvoiceStatus,
    addNotification,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
