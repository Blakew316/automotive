import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ShopProvider from './store/ShopProvider';
import UIProvider from './store/UIProvider';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Dashboard from './pages/Dashboard';
import Workflow from './pages/Workflow';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import NewOrder from './pages/NewOrder';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import NotFound from './pages/NotFound';

const Calendar = lazy(() => import('./pages/Calendar'));
const VinDecoder = lazy(() => import('./pages/VinDecoder'));
const Parts = lazy(() => import('./pages/Parts'));
const Library = lazy(() => import('./pages/Library'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const PrintOrder = lazy(() => import('./pages/PrintOrder'));
const CustomerReport = lazy(() => import('./pages/CustomerReport'));
const SharedReport = lazy(() => import('./pages/SharedReport'));
const CatalogHome = lazy(() => import('./pages/catalog/CatalogHome'));
const CatalogMake = lazy(() => import('./pages/catalog/CatalogMake'));
const CatalogModel = lazy(() => import('./pages/catalog/CatalogModel'));
const Messages = lazy(() => import('./pages/Messages'));
const Tech = lazy(() => import('./pages/Tech'));
const Team = lazy(() => import('./pages/Team'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Import = lazy(() => import('./pages/Import'));
const Book = lazy(() => import('./pages/Book'));

const Loading = () => (
  <div className="flex h-64 items-center justify-center text-ink-3">
    <Spinner size={20} />
  </div>
);

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <UIProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public pages (report links, online booking) open on customers' devices, so they never load shop data. */}
            <Route path="/share/:id" element={<SharedReport />} />
            <Route path="/book" element={<Book />} />
            <Route
              path="*"
              element={
                <ShopProvider>
                  <Suspense fallback={<Loading />}>
                    <Routes>
                      <Route path="/orders/:id/print" element={<PrintOrder />} />
                      <Route path="/orders/:id/report" element={<CustomerReport />} />
                      <Route element={<Layout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/workflow" element={<Workflow />} />
                        <Route path="/orders" element={<Orders />} />
                        <Route path="/orders/new" element={<NewOrder />} />
                        <Route path="/orders/:id" element={<OrderDetail />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/messages" element={<Messages />} />
                        <Route path="/messages/:customerId" element={<Messages />} />
                        <Route path="/marketing" element={<Marketing />} />
                        <Route path="/tech" element={<Tech />} />
                        <Route path="/team" element={<Team />} />
                        <Route path="/accounting" element={<Accounting />} />
                        <Route path="/integrations" element={<Integrations />} />
                        <Route path="/import" element={<Import />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/customers/:id" element={<CustomerDetail />} />
                        <Route path="/vehicles" element={<Vehicles />} />
                        <Route path="/vehicles/:id" element={<VehicleDetail />} />
                        <Route path="/vin" element={<VinDecoder />} />
                        <Route path="/catalog" element={<CatalogHome />} />
                        <Route path="/catalog/:make" element={<CatalogMake />} />
                        <Route path="/catalog/:make/:model" element={<CatalogModel />} />
                        <Route path="/parts" element={<Parts />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </ShopProvider>
              }
            />
          </Routes>
        </Suspense>
      </UIProvider>
    </BrowserRouter>
  );
}
