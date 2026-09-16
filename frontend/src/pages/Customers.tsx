import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Wallet } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Customer, formatMoney } from '../lib/types';
import { Card, Modal, Loading, EmptyState, SearchInput, Pagination } from '../components/ui';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '', notes: '' });
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers', { params: { search, page, pageSize } });
        setCustomers(res.data.customers);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [search, page, refreshKey]);

  const createCustomer = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await api.post('/customers', form);
      toast.success('Customer created');
      setCreateOpen(false);
      setForm({ name: '', phone: '', email: '', address: '', gstNumber: '', notes: '' });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto"><SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone..." /></div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Add Customer</button>
      </div>

      {loading ? (
        <Loading text="Loading customers..." />
      ) : customers.length === 0 ? (
        <Card><EmptyState title="No customers found" message="Add customers to track sales and credit" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>Add Customer</button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Address</th>
                  <th className="table-header text-right">Outstanding</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{c.name}</td>
                    <td className="table-cell">{c.phone || '-'}</td>
                    <td className="table-cell">{c.email || '-'}</td>
                    <td className="table-cell text-gray-500 truncate max-w-[200px]">{c.address || '-'}</td>
                    <td className="table-cell text-right">
                      <span className={(c.totalBalance || 0) > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}>{formatMoney(c.totalBalance || 0)}</span>
                    </td>
                    <td className="table-cell text-right">
                      <Link to={`/customers/${c.id}`} className="inline-flex items-center gap-1 text-gold-dark hover:underline text-sm">
                        <Eye size={14} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Customer"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createCustomer}>Create Customer</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">GST Number</label>
            <input className="input-field" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input-field !h-20 resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}