import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, Printer, ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Product, PRODUCT_STATUSES, METALS, formatMoney, formatWeight, statusColor } from '../lib/types';
import { Card, EmptyState, Loading, SearchInput, Pagination, Badge, Modal, ConfirmDialog } from '../components/ui';

export default function InventoryPage({ newItem }: { newItem?: boolean }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [metal, setMetal] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products', {
          params: { search, status, metal, page, pageSize },
        });
        setProducts(res.data.products);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [search, status, metal, page, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search item code, name, HUID, barcode..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input-field !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input-field !w-auto" value={metal} onChange={(e) => { setMetal(e.target.value); setPage(1); }}>
            <option value="">All Metals</option>
            {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Link to="/inventory/new" className="btn-primary">
            <Plus size={16} /> Add Item
          </Link>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading inventory..." />
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            title="No items found"
            message="Try changing filters or add a new jewellery item"
            action={<Link to="/inventory/new" className="btn-primary">Add Item</Link>}
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Code</th>
                  <th className="table-header">Name</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Metal</th>
                  <th className="table-header">Purity</th>
                  <th className="table-header">Net Weight</th>
                  <th className="table-header">Purchase Cost</th>
                  <th className="table-header">Selling Price</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">
                      <Link to={`/inventory/${p.id}`} className="text-gold-dark hover:underline">{p.itemCode}</Link>
                    </td>
                    <td className="table-cell">{p.name}</td>
                    <td className="table-cell">{p.category?.name || '-'}</td>
                    <td className="table-cell">{p.metal}</td>
                    <td className="table-cell">{p.purity === 100 ? 'Fine' : `${p.purity}K`}</td>
                    <td className="table-cell">{formatWeight(p.netWeight)}</td>
                    <td className="table-cell">{p.purchaseCost != null ? formatMoney(p.purchaseCost) : '-'}</td>
                    <td className="table-cell">{p.sellingPrice != null ? formatMoney(p.sellingPrice) : '-'}</td>
                    <td className="table-cell"><Badge status={p.status} /></td>
                    <td className="table-cell text-right">
                      <div className="flex gap-1 justify-end">
                        <Link to={`/inventory/${p.id}`} className="p-1.5 rounded hover:bg-gray-100 text-charcoal" title="View"><Eye size={16} /></Link>
                        <Link to={`/inventory/${p.id}?edit=1`} className="p-1.5 rounded hover:bg-gray-100 text-charcoal" title="Edit"><Edit size={16} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </Card>
      )}

      {newItem && <ProductForm onDone={() => { toast.success('Item created'); navigate('/inventory'); }} />}
    </div>
  );
}

export function ProductForm({ onDone, productId }: { onDone?: () => void; productId?: number }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    name: '',
    metal: 'GOLD',
    purity: 22,
    grossWeight: '',
    stoneWeight: 0,
    otherMaterialWeight: 0,
    makingCharge: 0,
    wastagePercent: 3,
    stoneCharge: 0,
    otherCharge: 0,
    discount: 0,
    taxRate: 3,
    hallmark: true,
    barcode: '',
    huid: '',
    purchaseCost: '',
    sellingPrice: '',
    notes: '',
    supplierId: '',
    categoryId: '',
    status: 'IN_STOCK',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [c, s] = await Promise.all([api.get('/categories'), api.get('/suppliers?pageSize=100')]);
        setCategories(c.data);
        setSuppliers(s.data.suppliers);
      } catch {}
    };
    fetchMeta();
    if (productId) {
      const fetchProduct = async () => {
        try {
          const res = await api.get(`/products/${productId}`);
          const p = res.data;
          setForm({
            name: p.name,
            metal: p.metal,
            purity: p.purity,
            grossWeight: p.grossWeight,
            stoneWeight: p.stoneWeight,
            otherMaterialWeight: p.otherMaterialWeight,
            makingCharge: p.makingCharge,
            wastagePercent: p.wastagePercent,
            stoneCharge: p.stoneCharge,
            otherCharge: p.otherCharge,
            discount: p.discount,
            taxRate: p.taxRate,
            hallmark: p.hallmark,
            barcode: p.barcode || '',
            huid: p.huid || '',
            purchaseCost: p.purchaseCost || '',
            sellingPrice: p.sellingPrice || '',
            notes: p.notes || '',
            supplierId: p.supplierId || '',
            categoryId: p.categoryId || '',
            status: p.status,
          });
        } catch (e) {
          toast.error(getErrorMessage(e));
        }
      };
      fetchProduct();
    }
  }, [productId]);

  const grossWeight = parseFloat(form.grossWeight) || 0;
  const stoneWeight = parseFloat(form.stoneWeight) || 0;
  const otherWeight = parseFloat(form.otherMaterialWeight) || 0;
  const netWeight = Math.max(0, grossWeight - stoneWeight - otherWeight);
  const fineness = (parseFloat(form.purity) || 0) / 24;
  const metalValue = netWeight * 7400;
  const suggestedPrice = Math.round(metalValue + (parseFloat(form.makingCharge) || 0) + metalValue * ((parseFloat(form.wastagePercent) || 0) / 100));

  const set = (field: string, value: any) => setForm((f: any) => ({ ...f, [field]: value }));

  const submit = async () => {
    if (!form.name || !form.grossWeight) {
      toast.error('Name and gross weight are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        grossWeight: parseFloat(form.grossWeight),
        stoneWeight: parseFloat(form.stoneWeight || 0),
        otherMaterialWeight: parseFloat(form.otherMaterialWeight || 0),
        purity: parseFloat(form.purity || 22),
        makingCharge: parseFloat(form.makingCharge || 0),
        wastagePercent: parseFloat(form.wastagePercent || 0),
        stoneCharge: parseFloat(form.stoneCharge || 0),
        otherCharge: parseFloat(form.otherCharge || 0),
        discount: parseFloat(form.discount || 0),
        taxRate: parseFloat(form.taxRate || 0),
        purchaseCost: form.purchaseCost !== '' ? parseFloat(form.purchaseCost) : undefined,
        sellingPrice: form.sellingPrice !== '' ? parseFloat(form.sellingPrice) : undefined,
        supplierId: form.supplierId ? parseInt(form.supplierId) : undefined,
        categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      };
      if (productId) {
        await api.put(`/products/${productId}`, payload);
      } else {
        await api.post('/products', payload);
      }
      onDone ? onDone() : navigate('/inventory');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => navigate('/inventory')}
      title={productId ? 'Edit Jewellery Item' : 'Add New Jewellery Item'}
      size="xl"
      footer={
        <>
          <button className="btn-ghost" onClick={() => navigate('/inventory')}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Saving...' : productId ? 'Update Item' : 'Create Item'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Item Name *</label>
          <input className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Gold Ring 22K" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input-field" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Metal</label>
          <select className="input-field" value={form.metal} onChange={(e) => set('metal', e.target.value)}>
            {METALS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Purity (Karat)</label>
          <select className="input-field" value={form.purity} onChange={(e) => set('purity', e.target.value)}>
            {[24, 22, 21, 18, 14, 9, 100].map((p) => (
              <option key={p} value={p}>{p === 100 ? 'Fine' : `${p}K`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Gross Weight (g) *</label>
          <input className="input-field" type="number" step="0.001" value={form.grossWeight} onChange={(e) => set('grossWeight', e.target.value)} />
        </div>
        <div>
          <label className="label">Stone Weight (g)</label>
          <input className="input-field" type="number" step="0.001" value={form.stoneWeight} onChange={(e) => set('stoneWeight', e.target.value)} />
        </div>
        <div>
          <label className="label">Other Material Weight (g)</label>
          <input className="input-field" type="number" step="0.001" value={form.otherMaterialWeight} onChange={(e) => set('otherMaterialWeight', e.target.value)} />
        </div>
        <div>
          <label className="label">Net Weight (g) — auto</label>
          <input className="input-field bg-gray-50" value={netWeight.toFixed(3)} disabled />
        </div>
        <div>
          <label className="label">Making Charge</label>
          <input className="input-field" type="number" value={form.makingCharge} onChange={(e) => set('makingCharge', e.target.value)} />
        </div>
        <div>
          <label className="label">Wastage %</label>
          <input className="input-field" type="number" value={form.wastagePercent} onChange={(e) => set('wastagePercent', e.target.value)} />
        </div>
        <div>
          <label className="label">Purchase Cost (₹)</label>
          <input className="input-field" type="number" value={form.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} placeholder={String(suggestedPrice)} />
        </div>
        <div>
          <label className="label">Selling Price (₹)</label>
          <input className="input-field" type="number" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} placeholder={String(suggestedPrice)} />
        </div>
        <div>
          <label className="label">HUID</label>
          <input className="input-field" value={form.huid} onChange={(e) => set('huid', e.target.value)} />
        </div>
        <div>
          <label className="label">Barcode</label>
          <input className="input-field" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input-field" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input-field !h-20 resize-none" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}