import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Supplier, formatMoney } from '../lib/types';
import { Card, Modal, Loading, EmptyState, SearchInput, Pagination } from '../components/ui';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '', gstNumber: '', bankName: '', bankAccount: '', ifsc: '', notes: '' });
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await api.get('/suppliers', { params: { search, page, pageSize } });
        setSuppliers(res.data.suppliers);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, [search, page, refreshKey]);

  const createSupplier = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await api.post('/suppliers', form);
      toast.success('Supplier created');
      setCreateOpen(false);
      setForm({ name: '', contactPerson: '', phone: '', email: '', address: '', gstNumber: '', bankName: '', bankAccount: '', ifsc: '', notes: '' });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto"><SearchInput value={search} onChange={setSearch} placeholder="Search supplier..." /></div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Add Supplier</button>
      </div>

      {loading ? (
        <Loading text="Loading suppliers..." />
      ) : suppliers.length === 0 ? (
        <Card><EmptyState title="No suppliers found" message="Add suppliers to track purchases" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}>Add Supplier</button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Email</th>
                  <th className="table-header text-right">Outstanding</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{s.name}</td>
                    <td className="table-cell">{s.contactPerson || '-'}</td>
                    <td className="table-cell">{s.phone || '-'}</td>
                    <td className="table-cell">{s.email || '-'}</td>
                    <td className="table-cell text-right">
                      <span className={(s.totalBalance || 0) > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}>{formatMoney(s.totalBalance || 0)}</span>
                    </td>
                    <td className="table-cell text-right">
                      <Link to={`/suppliers/${s.id}`} className="inline-flex items-center gap-1 text-gold-dark hover:underline text-sm">
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
        title="Add Supplier"
        size="lg"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createSupplier}>Create Supplier</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">Name *</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Contact Person</label><input className="input-field" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Address</label><input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="label">GST</label><input className="input-field" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} /></div>
          <div><label className="label">Bank Name</label><input className="input-field" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
          <div><label className="label">Account</label><input className="input-field" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></div>
          <div><label className="label">IFSC</label><input className="input-field" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}