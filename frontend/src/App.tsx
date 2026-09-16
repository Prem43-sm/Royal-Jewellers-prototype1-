import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SalesPage from './pages/Sales';
import InvoicesPage from './pages/Invoices';
import InventoryPage from './pages/Inventory';
import ProductDetail from './pages/ProductDetail';
import MetalStockPage from './pages/MetalStock';
import OldGoldPage from './pages/OldGold';
import PurchasesPage from './pages/Purchases';
import CustomersPage from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import SuppliersPage from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import OrdersPage from './pages/Orders';
import JobWorkPage from './pages/JobWork';
import RepairsPage from './pages/Repairs';
import AccountsPage from './pages/Accounts';
import ReportsPage from './pages/Reports';
import DocumentsPage from './pages/Documents';
import SettingsPage from './pages/Settings';
import AuditLogsPage from './pages/AuditLogs';
import BackupPage from './pages/Backup';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoicesPage detail />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/new" element={<InventoryPage newItem />} />
        <Route path="inventory/:id" element={<ProductDetail />} />
        <Route path="metal-stock" element={<MetalStockPage />} />
        <Route path="old-gold" element={<OldGoldPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="job-work" element={<JobWorkPage />} />
        <Route path="repairs" element={<RepairsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="audit-logs"
          element={
            <RequireRole roles={['OWNER']}>
              <AuditLogsPage />
            </RequireRole>
          }
        />
        <Route
          path="backup"
          element={
            <RequireRole roles={['OWNER']}>
              <BackupPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}