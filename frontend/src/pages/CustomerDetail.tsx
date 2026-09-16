import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Wallet, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { formatMoney, formatDateTime, formatDate, PAYMENT_METHODS } from '../lib/types';
import { Card, Loading, Badge, Modal, ConfirmDialog } from '../components/ui';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '', notes: '' });

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await api.get(`/customers/${id}`);
        setCustomer(res.data);
        setEditForm({
          name: res.data.name || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
          address: res.data.address || '',
          gstNumber: res.data.gstNumber || '',
          notes: res.data.notes || '',
        });
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id]);

  const saveEdit = async () => {
    try {
      await api.put(`/customers/${id}`, editForm);
      setEditOpen(false);
      toast.success('Customer updated');
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
      await api.post(`/customers/${id}/payments`, { amount, method: payMethod });
      setPayOpen(false);
      setPayAmount('');
      toast.success('Payment recorded');
      window.location.reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      navigate('/customers');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (loading) return <Loading text="Loading customer..." />;
  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/customers" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        <span className={`badge ${customer.totalBalance > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          Balance: {formatMoney(customer.totalBalance)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card title="Profile">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Phone</span><span>{customer.phone || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Email</span><span>{customer.email || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Address</span><span className="truncate max-w-[150px]">{customer.address || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">GST</span><span>{customer.gstNumber || '-'}</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setEditOpen(true)}><Edit size={16} /> Edit</button>
              <button className="btn-primary flex-1" onClick={() => setPayOpen(true)}><Wallet size={16} /> Payment</button>
              <button className="btn-ghost !text-red-500 px-3" onClick={() => setDeleteOpen(true)} title="Delete customer"><Trash2 size={16} /></button>
            </div>
          </Card>

          <Card title="Summary">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold">{formatMoney(customer.sales?.reduce((s: number, x: any) => s + x.grandTotal, 0) || 0)}</div>
                <div className="text-xs text-gray-400">Total Purchases</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold">{formatMoney(customer.sales?.reduce((s: number, x: any) => s + x.balanceAmount, 0) || 0)}</div>
                <div className="text-xs text-gray-400">Outstanding</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
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
                  {customer.transactions?.map((t: any) => (
                    <tr key={t.id}>
                      <td className="table-cell">{formatDateTime(t.createdAt)}</td>
                      <td className="table-cell"><Badge status={t.type} /></td>
                      <td className="table-cell">{t.description || '-'}</td>
                      <td className="table-cell text-right font-medium">{t.amount > 0 ? '+' : ''}{formatMoney(t.amount)}</td>
                      <td className="table-cell text-right">{formatMoney(t.balanceAfter)}</td>
                    </tr>
                  ))}
                  {(!customer.transactions || customer.transactions.length === 0) && (
                    <tr><td colSpan={5} className="table-cell text-center text-gray-400">No transactions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Sales">
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Invoice</th>
                    <th className="table-header">Date</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header text-right">Balance</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.sales?.map((s: any) => (
                    <tr key={s.id}>
                      <td className="table-cell">
                        <Link to={`/invoices/${s.id}`} className="text-gold-dark hover:underline">{s.invoiceNumber}</Link>
                      </td>
                      <td className="table-cell">{formatDate(s.createdAt)}</td>
                      <td className="table-cell text-right font-medium">{formatMoney(s.grandTotal)}</td>
                      <td className="table-cell text-right">{formatMoney(s.balanceAmount)}</td>
                      <td className="table-cell"><Badge status={s.status} /></td>
                    </tr>
                  ))}
                  {(!customer.sales || customer.sales.length === 0) && (
                    <tr><td colSpan={5} className="table-cell text-center text-gray-400">No sales yet</td></tr>
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
        title="Edit Customer"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit}>Save</button>
          </>
        }
      >
        <div className="space-y-3">
          {['name', 'phone', 'email', 'address', 'gstNumber', 'notes'].map((f) => (
            <div key={f}>
              <label className="label">{f.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}{f === 'name' ? ' *' : ''}</label>
              <input
                className="input-field"
                value={(editForm as any)[f]}
                onChange={(e) => setEditForm({ ...editForm, [f]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record Customer Payment"
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

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete customer?"
        message={`${customer.name} will be soft-deleted.`}
        confirmText="Delete"
      />
    </div>
  );
}