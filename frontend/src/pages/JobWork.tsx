import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { JobWork, formatWeight, formatDate, JOB_STATUSES } from '../lib/types';
import { Card, Modal, Loading, EmptyState, Badge } from '../components/ui';

export default function JobWorkPage() {
  const [jobWorks, setJobWorks] = useState<JobWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [returnModal, setReturnModal] = useState<JobWork | null>(null);
  const [form, setForm] = useState({ artisanId: '', expectedDate: '', labourCharge: '', notes: '' });
  const [items, setItems] = useState<any[]>([{ productId: '', metal: 'GOLD', purity: '22', issuedWeight: '' }]);

  useEffect(() => {
    fetchJobWorks();
    const fetchMeta = async () => {
      try {
        const [a, p] = await Promise.all([
          api.get('/artisans'),
          api.get('/products?pageSize=100&status=IN_STOCK'),
        ]);
        setArtisans(a.data);
        setProducts(p.data.products);
      } catch {}
    };
    fetchMeta();
  }, [refreshKey]);

  const fetchJobWorks = async () => {
    try {
      const res = await api.get('/job-works');
      setJobWorks(res.data.jobWorks);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!form.artisanId) {
      toast.error('Select an artisan');
      return;
    }
    const validItems = items.filter((i) => i.productId && i.issuedWeight);
    if (validItems.length === 0) {
      toast.error('Add at least one item with issued weight');
      return;
    }
    try {
      await api.post('/job-works', {
        ...form,
        labourCharge: parseFloat(String(form.labourCharge || 0)),
        expectedDate: form.expectedDate || undefined,
        items: validItems.map((i) => ({
          productId: i.productId,
          metal: i.metal,
          purity: parseFloat(i.purity),
          issuedWeight: parseFloat(i.issuedWeight),
        })),
      });
      toast.success('Job work issued');
      setCreateOpen(false);
      setForm({ artisanId: '', expectedDate: '', labourCharge: '', notes: '' });
      setItems([{ productId: '', metal: 'GOLD', purity: '22', issuedWeight: '' }]);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const completeReturn = async () => {
    if (!returnModal) return;
    try {
      const returns = returnModal.items?.map((i) => ({
        itemId: i.id,
        returnedWeight: i.returnedWeight,
        finished: true,
      }));
      await api.put(`/job-works/${returnModal.id}`, { returns, status: 'COMPLETED' });
      toast.success('Job work completed and gold returned');
      setReturnModal(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const setReturnWeight = (itemId: number, weight: number) => {
    if (!returnModal) return;
    setReturnModal({
      ...returnModal,
      items: returnModal.items?.map((i) => (i.id === itemId ? { ...i, returnedWeight: weight } : i)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Job Work / Artisan</h2>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Issue Job Work</button>
      </div>

      {loading ? (
        <Loading text="Loading job works..." />
      ) : jobWorks.length === 0 ? (
        <Card><EmptyState title="No job works" message="Issue gold to artisans for work" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>Issue Job Work</button>} /></Card>
      ) : (
        jobWorks.map((jw) => (
          <Card key={jw.id}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-semibold">{jw.jobNumber}</div>
                  <div className="text-sm text-gray-400">{jw.artisan?.name} · {formatDate(jw.jobDate)}</div>
                </div>
                <Badge status={jw.status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Labour: {formatMoney(jw.labourCharge)}</span>
                {jw.status !== 'COMPLETED' && jw.status !== 'CANCELLED' && (
                  <button className="btn-primary btn-sm" onClick={() => setReturnModal(jw)}>Record Return</button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Item</th>
                    <th className="table-header">Metal</th>
                    <th className="table-header">Purity</th>
                    <th className="table-header text-right">Issued</th>
                    <th className="table-header text-right">Returned</th>
                    <th className="table-header">Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {jw.items?.map((i) => (
                    <tr key={i.id}>
                      <td className="table-cell">{i.product?.itemCode || '-'} {i.product ? `· ${i.product.name}` : ''}</td>
                      <td className="table-cell">{i.metal}</td>
                      <td className="table-cell">{i.purity !== 100 ? `${i.purity}K` : 'Fine'}</td>
                      <td className="table-cell text-right font-medium">{formatWeight(i.issuedWeight)}</td>
                      <td className="table-cell text-right">{formatWeight(i.returnedWeight)}</td>
                      <td className="table-cell">{i.finished ? '✓' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Issue Job Work"
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submit}>Issue Gold</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Artisan *</label>
              <select className="input-field" value={form.artisanId} onChange={(e) => setForm({ ...form, artisanId: e.target.value })}>
                <option value="">Select artisan</option>
                {artisans.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><label className="label">Expected Date</label><input className="input-field" type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></div>
            <div><label className="label">Labour Charge</label><input className="input-field" type="number" value={form.labourCharge} onChange={(e) => setForm({ ...form, labourCharge: e.target.value })} /></div>
            <div><label className="label">Notes</label><input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="label !mb-0">Items to Issue</label>
              <button className="btn-secondary btn-sm" onClick={() => setItems([...items, { productId: '', metal: 'GOLD', purity: '22', issuedWeight: '' }])}><Plus size={14} /> Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select className="input-field flex-1" value={item.productId} onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, productId: e.target.value } : it)))}>
                    <option value="">Select item</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.itemCode} · {p.name} ({p.netWeight}g)</option>)}
                  </select>
                  <div className="flex gap-1">
                    <select className="input-field !w-24" value={item.metal} onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, metal: e.target.value } : it)))}>
                      {['GOLD', 'SILVER', 'OTHER'].map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <select className="input-field !w-20" value={item.purity} onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, purity: e.target.value } : it)))}>
                      {[24, 22, 18, 14, 9].map((p) => <option key={p} value={p}>{p}K</option>)}
                    </select>
                    <input className="input-field !w-24" type="number" step="0.001" placeholder="Issued (g)" value={item.issuedWeight} onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, issuedWeight: e.target.value } : it)))} />
                  </div>
                  <button className="text-red-400 hover:text-red-600" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!returnModal}
        onClose={() => setReturnModal(null)}
        title={returnModal ? `Record Return · ${returnModal.jobNumber}` : ''}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setReturnModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={completeReturn}>Complete Return</button>
          </>
        }
      >
        <div className="space-y-3">
          {returnModal?.items?.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">{i.product?.itemCode} · {i.product?.name}</div>
                <div className="text-xs text-gray-400">Issued: {i.issuedWeight}g</div>
              </div>
              <div>
                <label className="label !mb-0 !text-xs">Returned (g)</label>
                <input className="input-field !w-28 !h-8" type="number" step="0.001" defaultValue={i.returnedWeight || i.issuedWeight} onChange={(e) => setReturnWeight(i.id, parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function formatMoney(n: number) {
  if (n === null || n === undefined) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}