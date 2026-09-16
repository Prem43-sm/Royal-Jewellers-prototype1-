import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Order, formatMoney, formatDate, ORDER_STATUSES } from '../lib/types';
import { Card, Modal, Loading, EmptyState, Badge } from '../components/ui';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [form, setForm] = useState({
    customerId: '',
    jewelleryType: '',
    metal: 'GOLD',
    purity: '22',
    estimatedWeight: '',
    estimatedPrice: '',
    advance: '',
    expectedDate: '',
    notes: '',
    status: 'QUOTATION',
  });

  useEffect(() => {
    fetchOrders();
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers?pageSize=100');
        setCustomers(res.data.customers);
      } catch {}
    };
    fetchCustomers();
  }, [refreshKey]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders');
      setOrders(res.data.orders);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    try {
      await api.post('/orders', {
        ...form,
        purity: parseFloat(String(form.purity)),
        estimatedWeight: parseFloat(String(form.estimatedWeight || 0)),
        estimatedPrice: parseFloat(String(form.estimatedPrice || 0)),
        advance: parseFloat(String(form.advance || 0)),
        expectedDate: form.expectedDate || undefined,
        customerId: form.customerId || undefined,
      });
      toast.success('Order created');
      setCreateOpen(false);
      setForm({ customerId: '', jewelleryType: '', metal: 'GOLD', purity: '22', estimatedWeight: '', estimatedPrice: '', advance: '', expectedDate: '', notes: '', status: 'QUOTATION' });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const updateStatus = async (order: Order, status: string) => {
    try {
      await api.put(`/orders/${order.id}`, { status });
      toast.success(`Order ${status.replace(/_/g, ' ')}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const totalPrice = parseFloat(String(form.estimatedPrice || 0));
  const advance = parseFloat(String(form.advance || 0));
  const balance = Math.max(0, totalPrice - advance);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Customer Orders</h2>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New Order</button>
      </div>

      {loading ? (
        <Loading text="Loading orders..." />
      ) : orders.length === 0 ? (
        <Card><EmptyState title="No orders yet" message="Create customer orders for custom jewellery" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>New Order</button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Order #</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Type</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header text-right">Advance</th>
                  <th className="table-header text-right">Balance</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="table-cell font-medium">{o.orderNumber}</td>
                    <td className="table-cell">{formatDate(o.orderDate)}</td>
                    <td className="table-cell">{o.customer?.name || '-'}</td>
                    <td className="table-cell">{o.jewelleryType || '-'}</td>
                    <td className="table-cell text-right font-medium">{formatMoney(o.totalPrice)}</td>
                    <td className="table-cell text-right">{formatMoney(o.advance)}</td>
                    <td className="table-cell text-right">{formatMoney(o.balance)}</td>
                    <td className="table-cell"><Badge status={o.status} /></td>
                    <td className="table-cell text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setViewOrder(o)}>Details</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Custom Order"
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submit}>Create Order</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="label">Customer</label>
            <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Jewellery Type</label><input className="input-field" placeholder="e.g. Ring, Necklace" value={form.jewelleryType} onChange={(e) => setForm({ ...form, jewelleryType: e.target.value })} /></div>
          <div><label className="label">Metal</label>
            <select className="input-field" value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value })}>
              {['GOLD', 'SILVER', 'DIAMOND', 'PLATINUM', 'OTHER'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Purity (K)</label><input className="input-field" type="number" value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} /></div>
          <div><label className="label">Estimated Weight (g)</label><input className="input-field" type="number" step="0.001" value={form.estimatedWeight} onChange={(e) => setForm({ ...form, estimatedWeight: e.target.value })} /></div>
          <div><label className="label">Estimated Price (₹)</label><input className="input-field" type="number" value={form.estimatedPrice} onChange={(e) => setForm({ ...form, estimatedPrice: e.target.value })} /></div>
          <div><label className="label">Advance (₹)</label><input className="input-field" type="number" value={form.advance} onChange={(e) => setForm({ ...form, advance: e.target.value })} /></div>
          <div><label className="label">Expected Date</label><input className="input-field" type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {ORDER_STATUSES.filter((s) => s !== 'CANCELLED').map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input-field !h-20 resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="mt-4 p-3 bg-gold-light rounded-lg text-sm flex justify-between">
          <span>Expected Balance:</span><span className="font-bold">{formatMoney(balance)}</span>
        </div>
      </Modal>

      <Modal
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
        title={viewOrder ? `Order ${viewOrder.orderNumber}` : ''}
        size="lg"
        footer={<button className="btn-primary" onClick={() => setViewOrder(null)}>Close</button>}
      >
        {viewOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Customer: </span>{viewOrder.customer?.name || '-'}</div>
              <div><span className="text-gray-400">Status: </span><Badge status={viewOrder.status} /></div>
              <div><span className="text-gray-400">Type: </span>{viewOrder.jewelleryType || '-'}</div>
              <div><span className="text-gray-400">Metal: </span>{viewOrder.metal} {viewOrder.purity}K</div>
              <div><span className="text-gray-400">Weight: </span>{viewOrder.estimatedWeight}g</div>
              <div><span className="text-gray-400">Total: </span>{formatMoney(viewOrder.totalPrice)}</div>
              <div><span className="text-gray-400">Advance: </span>{formatMoney(viewOrder.advance)}</div>
              <div><span className="text-gray-400">Balance: </span><strong>{formatMoney(viewOrder.balance)}</strong></div>
            </div>
            {viewOrder.notes && <div className="p-3 bg-gray-50 rounded-lg text-sm">{viewOrder.notes}</div>}
            <div>
              <label className="label">Update Status</label>
              <div className="flex gap-2 flex-wrap">
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${viewOrder.status === s ? 'bg-gold text-white border-gold' : 'hover:bg-gray-50'}`}
                    onClick={() => { updateStatus(viewOrder, s); setViewOrder(null); }}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}