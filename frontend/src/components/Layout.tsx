import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Receipt, Package, Gem, RefreshCw, Truck, Users,
  Building2, ClipboardList, Hammer, Wrench, Wallet, BarChart3, FolderOpen, Settings,
  Shield, Database, LogOut, Bell, Menu, X, Search, Lock, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';
import api, { getErrorMessage } from '../lib/api';
import { formatMoney } from '../lib/types';
import { ToastContainer, toast } from './Toast';

interface NavItem {
  path: string;
  label: string;
  icon: any;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sales', label: 'Sales / POS', icon: ShoppingCart },
  { path: '/invoices', label: 'Invoices', icon: Receipt },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/metal-stock', label: 'Metal Stock', icon: Gem },
  { path: '/old-gold', label: 'Old Gold Exchange', icon: RefreshCw },
  { path: '/purchases', label: 'Purchases', icon: Truck },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/suppliers', label: 'Suppliers', icon: Building2 },
  { path: '/orders', label: 'Orders', icon: ClipboardList },
  { path: '/job-work', label: 'Job Work', icon: Hammer },
  { path: '/repairs', label: 'Repairs', icon: Wrench },
  { path: '/accounts', label: 'Accounts & Expenses', icon: Wallet },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/documents', label: 'Documents', icon: FolderOpen },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const OWNER_NAV_ITEMS: NavItem[] = [
  { path: '/audit-logs', label: 'Audit Logs', icon: Shield, roles: ['OWNER'] },
  { path: '/backup', label: 'Backup', icon: Database, roles: ['OWNER'] },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sales': 'Sales / Point of Sale',
  '/invoices': 'Invoices',
  '/inventory': 'Inventory',
  '/metal-stock': 'Metal Stock & Rates',
  '/old-gold': 'Old Gold Exchange',
  '/purchases': 'Purchases',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/orders': 'Customer Orders',
  '/job-work': 'Job Work / Artisan',
  '/repairs': 'Repairs',
  '/accounts': 'Accounts & Expenses',
  '/reports': 'Reports',
  '/documents': 'Documents',
  '/settings': 'Settings',
  '/audit-logs': 'Audit Logs',
  '/backup': 'Backup & Restore',
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { settings, fetch: fetchSettings } = useSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rates, setRates] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchSettings();
    const fetchRates = async () => {
      try {
        const res = await api.get('/metal-rates/today');
        setRates(res.data);
      } catch {}
    };
    fetchRates();
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/notifications');
        setNotifications(res.data);
      } catch {}
    };
    fetchNotifs();
  }, []);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.results);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isAccessible = (item: NavItem) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  };

  const goldRate = rates.find((r) => r.metal === 'GOLD' && r.purity === 22);
  const silverRate = rates.find((r) => r.metal === 'SILVER');
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const shopName = settings.shopName || 'Royal Jewellers';

  const pageTitle = PAGE_TITLES[location.pathname] || 'Management';

  const doSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.results);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const sidebarContent = (
    <div className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-charcoal text-gray-300 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <div className="font-semibold text-white leading-tight">{shopName}</div>
          <div className="text-xs text-gray-400">Management System</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <div className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-5">Menu</div>
        {NAV_ITEMS.map((item) => {
          if (!isAccessible(item)) return null;
          const active = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${active ? 'text-gold bg-white/5 border-l-2 border-gold' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 mt-4 px-5">Administration</div>
        {OWNER_NAV_ITEMS.map((item) => {
          if (!isAccessible(item)) return null;
          const active = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${active ? 'text-gold bg-white/5 border-l-2 border-gold' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.name}</div>
            <div className="text-xs text-gray-400">{user?.role}</div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-gray-400 hover:text-red-400 transition" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {sidebarContent}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b h-16 flex items-center px-4 lg:px-6 gap-3">
          <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>

          <h1 className="text-lg lg:text-xl font-semibold hidden sm:block">{pageTitle}</h1>

          <div className="flex-1 flex justify-center px-2">
            <div className="relative w-full max-w-md">
              <div className="flex items-center bg-gray-100 rounded-lg px-3 h-9">
                <Search size={16} className="text-gray-400 shrink-0" />
                <input
                  className="bg-transparent border-0 outline-none flex-1 ml-2 text-sm h-full w-full"
                  placeholder="Search items, customers, invoices..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    doSearch();
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                />
              </div>
              {searchOpen && searchResults && (
                <div className="absolute top-11 left-0 right-0 bg-white rounded-xl shadow-dropdown border z-50 max-h-[60vh] overflow-y-auto">
                  {Object.entries(searchResults).map(([key, items]: [string, any]) => {
                    if (!items || !items.length) return null;
                    const titles: Record<string, string> = {
                      products: 'Jewellery Items',
                      customers: 'Customers',
                      suppliers: 'Suppliers',
                      sales: 'Invoices',
                      orders: 'Orders',
                      repairs: 'Repairs',
                      jobWorks: 'Job Works',
                    };
                    return (
                      <div key={key} className="border-b last:border-0">
                        <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-400 bg-gray-50">{titles[key] || key}</div>
                        {items.map((item: any) => (
                          <button
                            key={`${key}-${item.id}`}
                            className="w-full text-left px-4 py-2.5 hover:bg-gold-light flex items-center justify-between text-sm"
                            onClick={() => {
                              if (key === 'products') navigate(`/inventory/${item.id}`);
                              else if (key === 'customers') navigate(`/customers/${item.id}`);
                              else if (key === 'suppliers') navigate(`/suppliers/${item.id}`);
                              else if (key === 'sales') navigate(`/invoices/${item.id}`);
                              else if (key === 'orders') navigate('/orders');
                              else if (key === 'repairs') navigate('/repairs');
                              else if (key === 'jobWorks') navigate('/job-work');
                              setSearchOpen(false);
                            }}
                          >
                            <div>
                              <div className="font-medium text-charcoal">{item.name || item.invoiceNumber || item.orderNumber || item.repairNumber || item.jobNumber || item.itemCode}</div>
                              {item.phone && <div className="text-xs text-gray-400">{item.phone}</div>}
                            </div>
                            <div className="text-xs text-gray-400">{item.status?.replace(/_/g, ' ')}</div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            {goldRate && (
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs text-gray-400">Gold 22K</span>
                <span className="text-sm font-semibold text-gold-dark">{formatMoney(goldRate.sellRate)}</span>
              </div>
            )}
            {silverRate && (
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs text-gray-400">Silver</span>
                <span className="text-sm font-semibold text-gray-600">{formatMoney(silverRate.sellRate)}</span>
              </div>
            )}

            <div className="hidden xl:flex items-center gap-1 text-gray-400 text-sm">
              <Lock size={14} />
              <span>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>

            <button className="relative text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100" title="Notifications">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}