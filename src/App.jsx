import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VinLookup from './pages/VinLookup';
import Estimates from './pages/Estimates';
import Invoices from './pages/Invoices';
import PartsFinder from './pages/PartsFinder';
import Manuals from './pages/Manuals';
import Customers from './pages/Customers';
import Vehicles from './pages/Vehicles';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vin-lookup" element={<VinLookup />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/parts" element={<PartsFinder />} />
            <Route path="/manuals" element={<Manuals />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/vehicles" element={<Vehicles />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
