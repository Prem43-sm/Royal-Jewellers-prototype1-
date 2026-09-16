import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { OldGoldExchange, formatMoney, formatWeight, formatDateTime } from '../lib/types';
import { Card, Modal, Loading, EmptyState, SearchInput } from '../components/ui';

export default function OldGoldPage() {
  const [exchanges, setExchanges] = useState<OldGoldExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: '',
    metal: 'GOLD',
    grossWeight: '',
    stoneWeight: '0',
    otherMaterialWeight: '0',
    testedPurity: '22',
    testingMethod: 'Touchstone',
    testingNotes: '',
    rate: '',
    deduction: '0',
    notes: '',
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchExchanges();
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers?pageSize=100');
        setCustomers(res.data.customers);
      } catch {}
    };
    fetchCustomers();
  }, [refreshKey]);

  const fetchExchanges = async () => {
    try {
      const res = await api.get('/old-gold?pageSize=100');
      setExchanges(res.data.exchanges);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const grossWeight = parseFloat(form.grossWeight) || 0;
  const stoneWeight = parseFloat(form.stoneWeight) || 0;
  const otherWeight = parseFloat(form.otherMaterialWeight) || 0;
  const netWeight = Math.max(0, grossWeight - stoneWeight - otherWeight);
  const fineness = (parseFloat(form.testedPurity) || 0) / 24;
  const fineGoldWeight = netWeight * fineness;
  const rate = parseFloat(form.rate) || 0;
  const grossValue = fineGoldWeight * rate;
  const deduction = parseFloat(form.deduction) || 0;
  const finalValue = Math.max(0, grossValue - deduction);

  const submit = async () => {
    if (!form.grossWeight || !form.rate) {
      toast.error('Weight and rate are required');
      return;
    }
    try {
      await api.post('/old-gold', { ...form, customerId: form.customerId || undefined });
      toast.success('Old gold recorded');
      setCreateOpen(false);
      setForm({ customerId: '', metal: 'GOLD', grossWeight: '', stoneWeight: '0', otherMaterialWeight: '0', testedPurity: '22', testingMethod: 'Touchstone', testingNotes: '', rate: '', deduction: '0', notes: '' });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Old Gold Exchange</h2>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New Exchange</button>
      </div>

      {loading ? (
        <Loading text="Loading exchanges..." />
      ) : exchanges.length === 0 ? (
        <Card><EmptyState title="No exchanges recorded" message="Record old gold purchases and exchanges" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>New Exchange</button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Gross</th>
                  <th className="table-header">Net</th>
                  <th className="table-header">Purity</th>
                  <th className="table-header">Fine Weight</th>
                  <th className="table-header text-right">Rate</th>
                  <th className="table-header text-right">Deduction</th>
                  <th className="table-header text-right">Final Value</th>
                </tr>
              </thead>
              <tbody>
                {exchanges.map((e) => (
                  <tr key={e.id}>
                    <td className="table-cell">{formatDateTime(e.createdAt)}</td>
                    <td className="table-cell">{e.customer?.name || '-'}</td>
                    <td className="table-cell">{formatWeight(e.grossWeight)}</td>
                    <td className="table-cell">{formatWeight(e.netWeight)}</td>
                    <td className="table-cell">{e.testedPurity}K</td>
                    <td className="table-cell font-medium">{formatWeight(e.fineGoldWeight)}</td>
                    <td className="table-cell text-right">{formatMoney(e.rate)}</td>
                    <td className="table-cell text-right">{formatMoney(e.deductions)}</td>
                    <td className="table-cell text-right font-semibold text-gold-dark">{formatMoney(e.finalValue)}</td>
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
        title="New Old Gold Exchange"
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submit}>Record Exchange</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Customer</label>
            <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select customer (optional)</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Metal</label>
            <select className="input-field" value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value })}>
              {['GOLD', 'SILVER', 'DIAMOND', 'PLATINUM', 'OTHER'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Gross Weight (g) *</label>
            <input className="input-field" type="number" step="0.001" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} />
          </div>
          <div>
            <label className="label">Stone Weight (g)</label>
            <input className="input-field" type="number" step="0.001" value={form.stoneWeight} onChange={(e) => setForm({ ...form, stoneWeight: e.target.value })} />
          </div>
          <div>
            <label className="label">Other Material (g)</label>
            <input className="input-field" type="number" step="0.001" value={form.otherMaterialWeight} onChange={(e) => setForm({ ...form, otherMaterialWeight: e.target.value })} />
          </div>
          <div>
            <label className="label">Tested Purity (K) *</label>
            <input className="input-field" type="number" step="0.1" min={0} max={24} value={form.testedPurity} onChange={(e) => setForm({ ...form, testedPurity: e.target.value })} />
          </div>
          <div>
            <label className="label">Testing Method</label>
            <input className="input-field" value={form.testingMethod} onChange={(e) => setForm({ ...form, testingMethod: e.target.value })} />
          </div>
          <div>
            <label className="label">Rate (₹/g) *</label>
            <input className="input-field" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </div>
          <div>
            <label className="label">Deductions (₹)</label>
            <input className="input-field" type="number" value={form.deduction} onChange={(e) => setForm({ ...form, deduction: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Testing Notes</label>
            <textarea className="input-field !h-20 resize-none" value={form.testingNotes} onChange={(e) => setForm({ ...form, testingNotes: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input-field !h-20 resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-gray-400">Net Weight</div><div className="font-bold">{netWeight.toFixed(3)}g</div></div>
              <div><div className="text-gray-400">Fine Gold</div><div className="font-bold">{fineGoldWeight.toFixed(3)}g</div></div>
              <div><div className="text-gray-400">Gross Value</div><div className="font-bold">{formatMoney(grossValue)}</div></div>
              <div><div className="text-gray-400">Final Value</div><div className="font-bold text-gold-dark">{formatMoney(finalValue)}</div></div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}