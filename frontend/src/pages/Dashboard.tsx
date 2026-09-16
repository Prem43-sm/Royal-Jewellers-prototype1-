import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Truck, TrendingUp, Wallet, Gem, Package, Users, Building2,
  ClipboardList, Hammer, Wrench, ArrowRight, DollarSign,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import api from '../lib/api';
import { DashboardData, formatMoney, formatWeight, statusColor } from '../lib/types';
import { Card, StatCard, Loading, Badge } from '../components/ui';
import { toast } from '../components/Toast';
import { getErrorMessage } from '../lib/api';

const PIE_COLORS = ['#C9A96E', '#93C5FD', '#FCD34D', '#F9A8D4', '#A5B4FC'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard');
        setData(res.data);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;
  if (!data) return null;

  const quickActions = [
    { label: 'New Sale', path: '/sales', icon: ShoppingCart, color: 'bg-gold text-white' },
    { label: 'Add Item', path: '/inventory/new', icon: Package, color: 'bg-charcoal text-white' },
    { label: 'Add Purchase', path: '/purchases', icon: Truck, color: 'bg-blue-600 text-white' },
    { label: 'Old Gold', path: '/old-gold', icon: Gem, color: 'bg-amber-500 text-white' },
    { label: 'Add Customer', path: '/customers', icon: Users, color: 'bg-green-600 text-white' },
    { label: 'Expense', path: '/accounts', icon: Wallet, color: 'bg-red-500 text-white' },
  ];

  const alerts = [
    ...data.customerDues.slice(0, 5).map((c) => ({ type: 'customer', text: `${c.name} owes ${formatMoney(c.balance)}`, path: `/customers/${c.id}`, icon: Users, color: 'border-amber-400 bg-amber-50' })),
    ...data.supplierDues.slice(0, 5).map((s) => ({ type: 'supplier', text: `Pay ${s.name} ${formatMoney(s.balance)}`, path: `/suppliers/${s.id}`, icon: Building2, color: 'border-red-400 bg-red-50' })),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Today's Sales" value={formatMoney(data.todaySales)} sub={`${data.todaySalesCount} invoices`} accent="gold" />
        <StatCard icon={Truck} label="Today's Purchases" value={formatMoney(data.todayPurchases)} sub={`${formatWeight(data.todayPurchasesWeight)} purchased`} accent="blue" />
        {data.canSeeFinancial && (
          <StatCard icon={TrendingUp} label="Today's Profit" value={formatMoney(data.todayProfit || 0)} accent="green" />
        )}
        <StatCard icon={Wallet} label="Customer Outstanding" value={formatMoney(data.customerOutstanding)} accent="amber" />
        <StatCard icon={Gem} label="Gold Stock" value={formatWeight(data.goldStock)} sub="IN_STOCK items" accent="gold" />
        <StatCard icon={Gem} label="Silver Stock" value={formatWeight(data.silverStock)} accent="gray" />
        <StatCard icon={Users} label="Supplier Outstanding" value={formatMoney(data.supplierOutstanding)} accent="red" />
        <StatCard icon={DollarSign} label="Today's Expenses" value={formatMoney(data.todayExpenses)} accent="purple" />
      </div>

      <div className="flex gap-3 flex-wrap">
        {quickActions.map((qa) => (
          <Link key={qa.label} to={qa.path} className={`${qa.color} inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition`}>
            <qa.icon size={16} />
            {qa.label}
            <ArrowRight size={14} />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Sales Trend (30 days)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(8)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => [formatMoney(Number(v)), 'Sales']} />
              <Line type="monotone" dataKey="total" stroke="#C9A96E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sales by Category (30 days)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.categorySales} dataKey="_sum.total" nameKey="metal" cx="50%" cy="50%" outerRadius={80} label={(e) => e.metal}>
                {data.categorySales.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card title="Today's Rates">
            <div className="space-y-3">
              {(data.todayRates || []).slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{r.metal}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.purity === 100 ? 'Fine' : `${r.purity}K`}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gold-dark font-semibold">{formatMoney(r.sellRate)}</span>
                  </div>
                </div>
              ))}
              {(data.todayRates || []).length === 0 && <div className="text-sm text-gray-400">No rates set for today</div>}
            </div>
          </Card>

          <Card title="Pending Work">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <ClipboardList size={16} className="text-purple-500" /> Orders
                </div>
                <Badge status={data.pendingOrders > 0 ? 'READY' : 'COMPLETED'} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Hammer size={16} className="text-indigo-500" /> Job Work
                </div>
                <Badge status={data.pendingJobWork > 0 ? 'IN_PROGRESS' : 'COMPLETED'} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Wrench size={16} className="text-orange-500" /> Repairs
                </div>
                <Badge status={data.pendingRepairs > 0 ? 'IN_PROGRESS' : 'COMPLETED'} />
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {alerts.length > 0 && (
            <Card title="Alerts">
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <Link key={i} to={a.path} className={`block p-3 rounded-lg border-l-4 ${a.color}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <a.icon size={16} />
                      <span className="text-charcoal">{a.text}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card title="Recent Transactions">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Invoice</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">Payment</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <Link to={`/invoices/${s.id}`} className="text-gold-dark font-medium hover:underline">{s.invoiceNumber}</Link>
                      </td>
                      <td className="table-cell">{s.customer?.name || 'Walk-in'}</td>
                      <td className="table-cell font-medium">{formatMoney(s.grandTotal)}</td>
                      <td className="table-cell">{s.paymentMethod}</td>
                      <td className="table-cell"><Badge status={s.status} /></td>
                    </tr>
                  ))}
                  {data.recentSales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="table-cell text-center text-gray-400">No transactions yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}