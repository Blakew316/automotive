import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ShopProvider from './store/ShopProvider';
import UIProvider from './store/UIProvider';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import NotFound from './pages/NotFound';

// Every page loads on demand, so the first screen appears quickly even on a shop tablet. The pages
// used all day are fetched in the background right after, so moving between them stays instant.
const EVERYDAY = {
  Dashboard: () => import('./pages/Dashboard'),
  Workflow: () => import('./pages/Workflow'),
  Orders: () => import('./pages/Orders'),
  OrderDetail: () => import('./pages/OrderDetail'),
  NewOrder: () => import('./pages/NewOrder'),
  Customers: () => import('./pages/Customers'),
  CustomerDetail: () => import('./pages/CustomerDetail'),
  Vehicles: () => import('./pages/Vehicles'),
  VehicleDetail: () => import('./pages/VehicleDetail'),
  Calendar: () => import('./pages/Calendar'),
  Messages: () => import('./pages/Messages'),
};
const Dashboard = lazy(EVERYDAY.Dashboard);
const Workflow = lazy(EVERYDAY.Workflow);
const Orders = lazy(EVERYDAY.Orders);
const OrderDetail = lazy(EVERYDAY.OrderDetail);
const NewOrder = lazy(EVERYDAY.NewOrder);
const Customers = lazy(EVERYDAY.Customers);
const CustomerDetail = lazy(EVERYDAY.CustomerDetail);
const Vehicles = lazy(EVERYDAY.Vehicles);
const VehicleDetail = lazy(EVERYDAY.VehicleDetail);
const Calendar = lazy(EVERYDAY.Calendar);
const Messages = lazy(EVERYDAY.Messages);

function usePrefetchEveryday() {
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    const id = idle(() => Object.values(EVERYDAY).forEach((load) => load().catch(() => {})));
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);
}

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
const Tech = lazy(() => import('./pages/Tech'));
const Team = lazy(() => import('./pages/Team'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Import = lazy(() => import('./pages/Import'));
const Book = lazy(() => import('./pages/Book'));
const SignIn = lazy(() => import('./pages/SignIn'));
const Track = lazy(() => import('./pages/Track'));
const Pay = lazy(() => import('./pages/Pay'));
const FleetPortal = lazy(() => import('./pages/FleetPortal'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Statement = lazy(() => import('./pages/Statement'));
const CheckIn = lazy(() => import('./pages/CheckIn'));
const FrontDesk = lazy(() => import('./pages/FrontDesk'));
const Lobby = lazy(() => import('./pages/Lobby'));
const CheckinSign = lazy(() => import('./pages/CheckinSign'));
const Timecards = lazy(() => import('./pages/Timecards'));

const Loading = () => (
  <div className="flex h-64 items-center justify-center text-ink-3">
    <Spinner size={20} />
  </div>
);

export default function App() {
  usePrefetchEveryday();
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <UIProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public pages (report links, online booking) open on customers' devices, so they never load shop data. */}
            <Route path="/share/:id" element={<SharedReport />} />
            <Route path="/book" element={<Book />} />
            <Route path="/track/:id" element={<Track />} />
            <Route path="/pay/:id" element={<Pay />} />
            <Route path="/fleet/:id" element={<FleetPortal />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route
              path="*"
              element={
                <ShopProvider>
                  <Suspense fallback={<Loading />}>
                    <Routes>
                      <Route path="/signin" element={<SignIn />} />
                      <Route path="/orders/:id/print" element={<PrintOrder />} />
                      <Route path="/orders/:id/report" element={<CustomerReport />} />
                      <Route path="/customers/:id/statement" element={<Statement />} />
                      <Route path="/lobby" element={<Lobby />} />
                      <Route path="/frontdesk/sign" element={<CheckinSign />} />
                      <Route path="/team/timecards" element={<Timecards />} />
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
                        <Route path="/accounts" element={<Accounts />} />
                        <Route path="/frontdesk" element={<FrontDesk />} />
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
