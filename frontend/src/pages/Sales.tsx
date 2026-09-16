import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2, Plus, Check, Printer, User } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Product, formatMoney, formatWeight, PAYMENT_METHODS } from '../lib/types';
import { Modal, Card, EmptyState, Loading } from '../components/ui';

interface CartItem {
  key: string;
  productId?: number;
  name: string;
  metal: string;
  purity: number;
  fineness: number;
  grossWeight: number;
  stoneWeight: number;
  otherMaterialWeight: number;
  netWeight: number;
  rate: number;
  makingCharge: number;
  wastagePercent: number;
  stoneCharge: number;
  otherCharge: number;
  discount: number;
  taxRate: number;
  quantity: number;
  metalValue: number;
  total: number;
}

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [newCustomerForm, setNewCustomerForm] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers?pageSize=100');
        setCustomers(res.data.customers);
      } catch {}
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setProducts([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(search)}&pageSize=15&page=${1}`);
        setProducts(res.data.products.filter((p: Product) => p.status === 'IN_STOCK' || p.status === 'RESERVED'));
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const grandTotal = useMemo(() => cart.reduce((s, i) => s + (i.total || 0), 0), [cart]);
  const payable = paidAmount !== '' ? parseFloat(paidAmount) : grandTotal;
  const balance = Math.max(0, grandTotal - payable);

  const handleScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const addToCart = async (product: Product) => {
    const todayRate = await getTodayRate(product.metal, product.purity);
    const item: CartItem = {
      key: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      metal: product.metal,
      purity: product.purity,
      fineness: product.fineness,
      grossWeight: product.grossWeight,
      stoneWeight: product.stoneWeight,
      otherMaterialWeight: product.otherMaterialWeight,
      netWeight: product.netWeight,
      rate: todayRate,
      makingCharge: product.makingCharge,
      wastagePercent: product.wastagePercent,
      stoneCharge: product.stoneCharge,
      otherCharge: product.otherCharge,
      discount: product.discount || 0,
      taxRate: product.taxRate || 0,
      quantity: 1,
      metalValue: product.netWeight * todayRate,
      total: 0,
    };

    const calc = calculateItem(item);
    item.total = calc.total;
    item.metalValue = calc.metalValue;
    setCart((c) => [...c, item]);
    toast.success(`${product.itemCode} added to cart`);
    setSearch('');
    setProducts([]);
  };

  const calculateItem = (item: CartItem) => {
    const netWeight = item.grossWeight - item.stoneWeight - item.otherMaterialWeight;
    const metalValue = netWeight * item.rate;
    const making = item.makingCharge;
    const wastage = metalValue * (item.wastagePercent / 100);
    const subTotal = metalValue + making + wastage + item.stoneCharge + item.otherCharge - item.discount;
    const tax = subTotal * (item.taxRate / 100);
    return { total: Math.max(0, subTotal + tax), metalValue, wastage };
  };

  const getTodayRate = async (metal: string, purity: number): Promise<number> => {
    try {
      const res = await api.get('/metal-rates/today');
      const rate = res.data.find((r: any) => r.metal === metal && r.purity === purity);
      if (!rate) {
        const fallback = res.data.find((r: any) => r.metal === metal);
        if (fallback) {
          return fallback.sellRate;
        }
      }
      return rate ? rate.sellRate : 0;
    } catch {
      return 0;
    }
  };

  const removeFromCart = (key: string) => {
    setCart((c) => c.filter((i) => i.key !== key));
  };

  const updateField = (key: string, field: string, value: number) => {
    setCart((cart) =>
      cart.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, [field]: value };
        const calc = calculateItem(updated);
        updated.total = calc.total;
        updated.metalValue = calc.metalValue;
        return updated;
      })
    );
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer?.id,
        paymentMethod,
        paidAmount: payable,
        notes: notes || undefined,
        items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          metal: i.metal,
          purity: i.purity,
          fineness: i.fineness,
          grossWeight: i.grossWeight,
          stoneWeight: i.stoneWeight,
          otherMaterialWeight: i.otherMaterialWeight,
          rate: i.rate,
          makingCharge: i.makingCharge,
          wastagePercent: i.wastagePercent,
          stoneCharge: i.stoneCharge,
          otherCharge: i.otherCharge,
          discount: i.discount,
          taxRate: i.taxRate,
          quantity: i.quantity,
        })),
      };
      const res = await api.post('/sales', payload);
      setCompletedSale(res.data.sale);
      setCart([]);
      setPaidAmount('');
      setNotes('');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const createCustomer = async () => {
    try {
      const res = await api.post('/customers', newCustomer);
      setCustomers((c) => [...c, res.data]);
      setSelectedCustomer(res.data);
      setCustomerModalOpen(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setNewCustomerForm(false);
      toast.success('Customer created');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const filteredCustomers = customerQuery
    ? customers.filter((c) => c.name.toLowerCase().includes(customerQuery.toLowerCase()) || (c.phone || '').includes(customerQuery))
    : customers;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <Card title="Search Items">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field !pl-10 h-12"
              placeholder="Scan barcode or search item code / name / HUID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleScan}
              autoFocus
            />
          </div>
          {searching && <Loading text="Searching..." />}
          {products.length > 0 && (
            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-gold-light transition text-left"
                  onClick={() => addToCart(p)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${p.metal === 'GOLD' ? 'bg-gold-light text-gold-dark' : 'bg-gray-100 text-gray-600'}`}>
                      {p.metal}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">
                        {p.itemCode} · {p.purity !== 100 ? `${p.purity}K` : 'Fine'} · {formatWeight(p.netWeight)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-400">{formatMoney(p.sellingPrice || 0)}</div>
                    <div className="text-[10px] text-green-600">{p.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Selected Items (${cart.length})`}>
          {cart.length === 0 ? (
            <EmptyState title="Cart is empty" message="Search and select products to add to the sale" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Item</th>
                    <th className="table-header">Net Weight</th>
                    <th className="table-header">Rate</th>
                    <th className="table-header">Making</th>
                    <th className="table-header">Wastage %</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.key} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.purity}K · {formatWeight(item.netWeight)}</div>
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          className="input-field !w-24 !h-8 !py-1"
                          value={item.netWeight}
                          onChange={(e) => updateField(item.key, 'netWeight', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          className="input-field !w-24 !h-8 !py-1"
                          value={item.rate}
                          onChange={(e) => updateField(item.key, 'rate', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          className="input-field !w-20 !h-8 !py-1"
                          value={item.makingCharge}
                          onChange={(e) => updateField(item.key, 'makingCharge', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          className="input-field !w-20 !h-8 !py-1"
                          value={item.wastagePercent}
                          onChange={(e) => updateField(item.key, 'wastagePercent', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="table-cell text-right font-semibold">{formatMoney(item.total)}</td>
                      <td className="table-cell">
                        <button onClick={() => removeFromCart(item.key)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <Card title="Customer">
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{selectedCustomer.name}</div>
                <div className="text-xs text-gray-400">{selectedCustomer.phone || selectedCustomer.email || 'No contact'}</div>
                {selectedCustomer.totalBalance > 0 && (
                  <div className="text-xs text-amber-600 mt-1">Balance: {formatMoney(selectedCustomer.totalBalance)}</div>
                )}
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>Remove</button>
            </div>
          ) : (
            <div>
              <input
                className="input-field"
                placeholder="Search customer by name/phone..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {filteredCustomers.slice(0, 15).map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gold-light text-sm flex justify-between"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-gray-400">{c.phone}</span>
                  </button>
                ))}
              </div>
              <button className="btn-secondary w-full mt-2" onClick={() => { setNewCustomerForm(true); setCustomerModalOpen(true); }}>
                <User size={16} /> New Customer
              </button>
            </div>
          )}
        </Card>

        <Card title="Summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatMoney(grandTotal)}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paid Amount</span>
              <input
                type="number"
                className="input-field !w-32 !h-8 !py-1 text-right"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={String(grandTotal)}
              />
            </div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <span>Balance Due</span>
              <span className={balance > 0 ? 'text-amber-600' : 'text-green-600'}>{formatMoney(balance)}</span>
            </div>
          </div>
        </Card>

        <Card title="Payment Method">
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${paymentMethod === m ? 'bg-gold text-white border-gold' : 'hover:bg-gray-50'}`}
                onClick={() => setPaymentMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <textarea
            className="input-field mt-3 !h-20 resize-none"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Card>

        <button className="btn-primary w-full !h-12 text-base" onClick={completeSale} disabled={submitting || cart.length === 0}>
          <Check size={18} />
          {submitting ? 'Processing...' : `Complete Sale ${formatMoney(payable)}`}
        </button>
      </div>

      <Modal
        open={completedSale}
        onClose={() => setCompletedSale(null)}
        title="Sale Completed"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCompletedSale(null)}>Close</button>
            <button className="btn-primary" onClick={() => window.open(`/api/sales/${completedSale?.id}`, '_blank')}>
              <Printer size={16} /> View
            </button>
          </>
        }
      >
        {completedSale && (
          <div className="space-y-3">
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-2">
                <Check size={24} className="text-green-600" />
              </div>
              <div className="text-2xl font-bold">{formatMoney(completedSale.grandTotal)}</div>
              <div className="text-sm text-gray-400">Invoice {completedSale.invoiceNumber}</div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header">Item</th>
                    <th className="table-header text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSale.items?.map((i: any, idx: number) => (
                    <tr key={idx}>
                      <td className="table-cell">{i.name}</td>
                      <td className="table-cell text-right">{formatMoney(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link to={`/invoices/${completedSale.id}`} className="btn-primary w-full flex justify-center">
              Open Invoice
            </Link>
          </div>
        )}
      </Modal>

      <Modal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title="New Customer"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCustomerModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createCustomer}>Create Customer</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input-field" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}