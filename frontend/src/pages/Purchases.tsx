import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Purchase, formatMoney, formatWeight, formatDateTime, PAYMENT_METHODS } from '../lib/types';
import { Card, Modal, Loading, EmptyState, SearchInput, Pagination, Badge } from '../components/ui';

const PURITIES = [24, 22, 21, 18, 14, 9, 100];

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const res = await api.get('/purchases', { params: { search, page, pageSize } });
        setPurchases(res.data.purchases);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [search, page, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto"><SearchInput value={search} onChange={setSearch} placeholder="Search purchase number or supplier..." /></div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New Purchase</button>
      </div>

      {loading ? (
        <Loading text="Loading purchases..." />
      ) : purchases.length === 0 ? (
        <Card><EmptyState title="No purchases yet" message="Record purchases from suppliers" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>New Purchase</button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Purchase #</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Supplier</th>
                  <th className="table-header text-right">Items</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header text-right">Paid</th>
                  <th className="table-header text-right">Balance</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-gold-dark">{p.purchaseNumber}</td>
                    <td className="table-cell">{formatDateTime(p.createdAt)}</td>
                    <td className="table-cell">{p.supplier?.name}</td>
                    <td className="table-cell text-right">{p.items?.length || 0}</td>
                    <td className="table-cell text-right font-medium">{formatMoney(p.totalCost)}</td>
                    <td className="table-cell text-right">{formatMoney(p.paidAmount)}</td>
                    <td className="table-cell text-right">{formatMoney(p.balanceAmount)}</td>
                    <td className="table-cell"><Badge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </Card>
      )}

      {createOpen && (
        <PurchaseForm
          onDone={() => {
            setCreateOpen(false);
            setRefreshKey((k) => k + 1);
            toast.success('Purchase recorded');
          }}
        />
      )}
    </div>
  );
}

function PurchaseForm({ onDone }: { onDone: () => void }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState({
    supplierId: '',
    paymentMethod: 'CASH',
    paidAmount: '',
    notes: '',
  });
  const [items, setItems] = useState<any[]>([
    { name: '', metal: 'GOLD', purity: '22', grossWeight: '', stoneWeight: '0', otherMaterialWeight: '0', rate: '', cost: '', quantity: '1' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await api.get('/suppliers?pageSize=100');
        setSuppliers(res.data.suppliers);
      } catch {}
    };
    fetchSuppliers();
  }, []);

  const totalCost = items.reduce((s, i) => {
    const cost = parseFloat(i.cost) || parseFloat(i.rate || 0) * (parseFloat(i.grossWeight) || 0);
    return s + cost * (parseFloat(i.quantity) || 1);
  }, 0);

  const setItem = (idx: number, field: string, value: string) => {
    setItems((its) => its.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems((its) => [...its, { name: '', metal: 'GOLD', purity: '22', grossWeight: '', stoneWeight: '0', otherMaterialWeight: '0', rate: '', cost: '', quantity: '1' }]);

  const removeItem = (idx: number) => setItems((its) => its.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!form.supplierId) {
      toast.error('Select a supplier');
      return;
    }
    const validItems = items.filter((i) => i.grossWeight || i.rate || i.cost);
    if (validItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        supplierId: form.supplierId,
        paymentMethod: form.paymentMethod,
        paidAmount: form.paidAmount || 0,
        notes: form.notes || undefined,
        items: validItems.map((i) => ({
          name: i.name || 'Purchased item',
          metal: i.metal,
          purity: parseFloat(i.purity),
          grossWeight: parseFloat(i.grossWeight),
          stoneWeight: parseFloat(i.stoneWeight),
          otherMaterialWeight: parseFloat(i.otherMaterialWeight),
          rate: i.rate ? parseFloat(i.rate) : undefined,
          cost: i.cost ? parseFloat(i.cost) : undefined,
          quantity: parseInt(i.quantity) || 1,
          createItem: true,
        })),
      };
      await api.post('/purchases', payload);
      onDone();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => onDone()}
      title="New Purchase"
      size="xl"
      footer={
        <>
          <button className="btn-ghost" onClick={() => onDone()}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Recording...' : `Record Purchase · ${formatMoney(totalCost)}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Supplier *</label>
            <select className="input-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input-field" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Paid Amount (₹)</label>
            <input className="input-field" type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label !mb-0">Purchase Items</label>
            <button className="btn-secondary btn-sm" onClick={addItem}><Plus size={14} /> Add Item</button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {items.map((item, idx) => {
              const netW = Math.max(0, (parseFloat(item.grossWeight) || 0) - (parseFloat(item.stoneWeight) || 0) - (parseFloat(item.otherMaterialWeight) || 0));
              const lineCost = (parseFloat(item.cost) || (parseFloat(item.rate) || 0) * (parseFloat(item.grossWeight) || 0)) * (parseFloat(item.quantity) || 1);
              return (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg border">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <input className="input-field !h-9 md:col-span-2 !text-xs" placeholder="Item name" value={item.name} onChange={(e) => setItem(idx, 'name', e.target.value)} />
                    <select className="input-field !h-9 !text-xs" value={item.metal} onChange={(e) => setItem(idx, 'metal', e.target.value)}>
                      {['GOLD', 'SILVER', 'DIAMOND', 'PLATINUM', 'OTHER'].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className="input-field !h-9 !text-xs" value={item.purity} onChange={(e) => setItem(idx, 'purity', e.target.value)}>
                      {PURITIES.map((p) => <option key={p} value={p}>{p === 100 ? 'Fine' : `${p}K`}</option>)}
                    </select>
                    <input className="input-field !h-9 !text-xs" type="number" placeholder="Gross (g)" value={item.grossWeight} onChange={(e) => setItem(idx, 'grossWeight', e.target.value)} />
                    <input className="input-field !h-9 !text-xs" type="number" placeholder="Rate/g" value={item.rate} onChange={(e) => setItem(idx, 'rate', e.target.value)} />
                    <input className="input-field !h-9 !text-xs" type="number" placeholder="Cost" value={item.cost} onChange={(e) => setItem(idx, 'cost', e.target.value)} />
                    <input className="input-field !h-9 !text-xs" type="number" placeholder="Qty" value={item.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} />
                    <div className="flex items-center justify-between md:col-span-5">
                      <span className="text-xs text-gray-500">Net: {netW.toFixed(3)}g</span>
                      <span className="text-xs font-semibold">{formatMoney(lineCost)}</span>
                    </div>
                    <div className="flex justify-end">
                      <button className="text-red-400 hover:text-red-600" onClick={() => removeItem(idx)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end p-3 bg-gold-light rounded-lg">
          <div className="text-lg font-bold text-gold-dark">{formatMoney(totalCost)}</div>
        </div>
      </div>
    </Modal>
  );
}