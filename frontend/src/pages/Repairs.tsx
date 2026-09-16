import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Repair, formatMoney, formatDate, REPAIR_STATUSES } from '../lib/types';
import { Card, Modal, Loading, EmptyState, Badge } from '../components/ui';

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({
    customerId: '', productId: '', problem: '', estimatedCost: '', advancePaid: '',
    receivedDate: new Date().toISOString().slice(0, 10), expectedDelivery: '', artisanId: '', notes: '',
  });

  useEffect(() => {
    fetchRepairs();
    const fetchMeta = async () => {
      try {
        const [c, p, a] = await Promise.all([
          api.get('/customers?pageSize=100'),
          api.get('/products?pageSize=100'),
          api.get('/artisans'),
        ]);
        setCustomers(c.data.customers);
        setProducts(p.data.products);
        setArtisans(a.data);
      } catch {}
    };
    fetchMeta();
  }, [refreshKey]);

  const fetchRepairs = async () => {
    try {
      const res = await api.get('/repairs');
      setRepairs(res.data.repairs || res.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    try {
      await api.post('/repairs', {
        ...form,
        customerId: form.customerId || undefined,
        productId: form.productId || undefined,
        artisanId: form.artisanId || undefined,
        estimatedCost: parseFloat(String(form.estimatedCost || 0)),
        advancePaid: parseFloat(String(form.advancePaid || 0)),
        receivedDate: form.receivedDate || undefined,
        expectedDelivery: form.expectedDelivery || undefined,
      });
      toast.success('Repair received');
      setCreateOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const updateStatus = async (repair: Repair, status: string) => {
    try {
      await api.put(`/repairs/${repair.id}`, { status });
      toast.success(`Repair ${status.replace(/_/g, ' ')}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Repairs</h2>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Receive for Repair</button>
      </div>

      {loading ? (
        <Loading text="Loading repairs..." />
      ) : repairs.length === 0 ? (
        <Card><EmptyState title="No repairs" message="Receive jewellery for repair" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>Receive for Repair</button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Repair #</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Item</th>
                  <th className="table-header">Problem</th>
                  <th className="table-header text-right">Est. Cost</th>
                  <th className="table-header text-right">Advance</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((r) => (
                  <tr key={r.id}>
                    <td className="table-cell font-medium">{r.repairNumber}</td>
                    <td className="table-cell">{formatDate(r.receivedDate)}</td>
                    <td className="table-cell">{r.customer?.name || '-'}</td>
                    <td className="table-cell">{r.product ? `${r.product.itemCode} · ${r.product.name}` : '-'}</td>
                    <td className="table-cell text-gray-500 truncate max-w-[180px]">{r.problem || '-'}</td>
                    <td className="table-cell text-right font-medium">{formatMoney(r.estimatedCost)}</td>
                    <td className="table-cell text-right">{formatMoney(r.advancePaid)}</td>
                    <td className="table-cell"><Badge status={r.status} /></td>
                    <td className="table-cell text-right">
                      <select
                        className="input-field !w-auto !h-8 text-xs"
                        value={r.status}
                        onChange={(e) => updateStatus(r, e.target.value)}
                        disabled={r.status === 'DELIVERED' || r.status === 'CANCELLED'}
                      >
                        {REPAIR_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
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
        title="Receive Item for Repair"
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submit}>Receive Item</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Customer</label>
            <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Item</label>
            <select className="input-field" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Select item</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.itemCode} · {p.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label className="label">Problem *</label><input className="input-field" value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} /></div>
          <div><label className="label">Received Date</label><input className="input-field" type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} /></div>
          <div><label className="label">Expected Delivery</label><input className="input-field" type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} /></div>
          <div><label className="label">Estimated Cost (₹)</label><input className="input-field" type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} /></div>
          <div><label className="label">Advance Paid (₹)</label><input className="input-field" type="number" value={form.advancePaid} onChange={(e) => setForm({ ...form, advancePaid: e.target.value })} /></div>
          <div>
            <label className="label">Artisan</label>
            <select className="input-field" value={form.artisanId} onChange={(e) => setForm({ ...form, artisanId: e.target.value })}>
              <option value="">Select artisan</option>
              {artisans.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label className="label">Notes</label><input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}