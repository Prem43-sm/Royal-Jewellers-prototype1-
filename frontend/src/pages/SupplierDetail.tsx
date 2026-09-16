import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Wallet } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { formatMoney, formatDateTime, formatDate, PAYMENT_METHODS } from '../lib/types';
import { Card, Loading, Badge, Modal } from '../components/ui';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const res = await api.get(`/suppliers/${id}`);
        setSupplier(res.data);
        const { name, contactPerson, phone, email, address, gstNumber, bankName, bankAccount, ifsc, notes } = res.data;
        setEditForm({ name, contactPerson, phone, email, address, gstNumber, bankName, bankAccount, ifsc, notes });
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [id]);

  const saveEdit = async () => {
    try {
      await api.put(`/suppliers/${id}`, editForm);
      setEditOpen(false);
      toast.success('Supplier updated');
      window.location.reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const recordPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await api.post(`/suppliers/${id}/payments`, { amount, method: payMethod });
      toast.success('Payment recorded');
      setPayOpen(false);
      setPayAmount('');
      window.location.reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (loading) return <Loading text="Loading supplier..." />;
  if (!supplier) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/suppliers" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-semibold">{supplier.name}</h1>
        <span className={`badge ${supplier.totalBalance > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          Balance: {formatMoney(supplier.totalBalance)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card title="Profile">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Contact</span><span>{supplier.contactPerson || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Phone</span><span>{supplier.phone || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Email</span><span>{supplier.email || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">GST</span><span>{supplier.gstNumber || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Bank</span><span>{supplier.bankName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Account</span><span>{supplier.bankAccount || '-'}</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setEditOpen(true)}><Edit size={16} /> Edit</button>
              <button className="btn-primary flex-1" onClick={() => setPayOpen(true)}><Wallet size={16} /> Pay</button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card title="Purchases">
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Purchase #</th>
                    <th className="table-header">Date</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.purchases?.map((p: any) => (
                    <tr key={p.id}>
                      <td className="table-cell font-medium">{p.purchaseNumber}</td>
                      <td className="table-cell">{formatDate(p.createdAt)}</td>
                      <td className="table-cell text-right font-medium">{formatMoney(p.totalCost)}</td>
                      <td className="table-cell text-right">{formatMoney(p.balanceAmount)}</td>
                    </tr>
                  ))}
                  {(!supplier.purchases || supplier.purchases.length === 0) && (
                    <tr><td colSpan={4} className="table-cell text-center text-gray-400">No purchases yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Transactions">
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Date</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Description</th>
                    <th className="table-header text-right">Amount</th>
                    <th className="table-header text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.transactions?.map((t: any) => (
                    <tr key={t.id}>
                      <td className="table-cell">{formatDateTime(t.createdAt)}</td>
                      <td className="table-cell"><Badge status={t.type} /></td>
                      <td className="table-cell">{t.description || '-'}</td>
                      <td className="table-cell text-right font-medium">{t.amount > 0 ? '+' : ''}{formatMoney(t.amount)}</td>
                      <td className="table-cell text-right">{formatMoney(t.balanceAfter)}</td>
                    </tr>
                  ))}
                  {(!supplier.transactions || supplier.transactions.length === 0) && (
                    <tr><td colSpan={5} className="table-cell text-center text-gray-400">No transactions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Supplier"
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit}>Save</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.keys(editForm).map((f) => (
            <div key={f}>
              <label className="label">{f.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</label>
              <input
                className="input-field"
                value={String(editForm[f] ?? '')}
                onChange={(e) => setEditForm({ ...editForm, [f]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record Supplier Payment"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPayOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={recordPayment}>Record</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input-field" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input-field" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}