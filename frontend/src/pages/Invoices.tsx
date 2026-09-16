import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, ArrowLeft, Download } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Sale, formatMoney, formatWeight, formatDate, formatDateTime, PAYMENT_METHODS } from '../lib/types';
import { Card, Loading, EmptyState, SearchInput, Pagination, Badge, Modal } from '../components/ui';

export default function InvoicesPage({ detail }: { detail?: boolean }) {
  const { id } = useParams();
  if (detail && id) return <InvoiceDetail saleId={parseInt(id)} />;
  return <InvoiceList />;
}

function InvoiceList() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [paymentFilter, setPaymentFilter] = useState('');
  const pageSize = 20;
  const [refundTarget, setRefundTarget] = useState<Sale | null>(null);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await api.get('/sales', { params: { search, page, pageSize, paymentMethod: paymentFilter || undefined } });
        setSales(res.data.sales);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [search, page, paymentFilter]);

  const handleCancelSale = async (sale: Sale) => {
    try {
      await api.delete(`/sales/${sale.id}`);
      toast.success(`Invoice ${sale.invoiceNumber} cancelled and stock restored`);
      setRefundTarget(null);
      setPage(1);
      window.location.reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto"><SearchInput value={search} onChange={setSearch} placeholder="Search invoice number or customer..." /></div>
        <select className="input-field !w-auto" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="">All Payments</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading ? (
        <Loading text="Loading invoices..." />
      ) : sales.length === 0 ? (
        <Card><EmptyState title="No invoices found" message="Sales you make will appear here" /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header text-right">Items</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header text-right">Paid</th>
                  <th className="table-header text-right">Balance</th>
                  <th className="table-header">Payment</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <Link to={`/invoices/${s.id}`} className="text-gold-dark font-medium hover:underline">{s.invoiceNumber}</Link>
                    </td>
                    <td className="table-cell">{formatDateTime(s.createdAt)}</td>
                    <td className="table-cell">{s.customer?.name || 'Walk-in'}</td>
                    <td className="table-cell text-right">{s.items?.length || 0}</td>
                    <td className="table-cell text-right font-medium">{formatMoney(s.grandTotal)}</td>
                    <td className="table-cell text-right">{formatMoney(s.paidAmount)}</td>
                    <td className="table-cell text-right">{formatMoney(s.balanceAmount)}</td>
                    <td className="table-cell">{s.paymentMethod}</td>
                    <td className="table-cell"><Badge status={s.status} /></td>
                    <td className="table-cell text-right">
                      <div className="flex gap-1 justify-end">
                        <Link to={`/invoices/${s.id}`} className="p-1.5 rounded hover:bg-gray-100"><Printer size={16} /></Link>
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

      <Modal
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title="Cancel Invoice"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setRefundTarget(null)}>Keep Invoice</button>
            <button className="btn-danger" onClick={() => refundTarget && handleCancelSale(refundTarget)}>Cancel & Restore Stock</button>
          </>
        }
      >
        <p className="text-sm text-gray-500">
          This will cancel invoice <strong>{refundTarget?.invoiceNumber}</strong> for {formatMoney(refundTarget?.grandTotal || 0)}.
          Stock will be restored to inventory. This action is audited.
        </p>
      </Modal>
    </div>
  );
}

function InvoiceDetail({ saleId }: { saleId: number }) {
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const res = await api.get(`/sales/${saleId}/invoice`);
        setSale(res.data.sale);
        setSettings(res.data.settings);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [saleId]);

  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      const res = await api.post(`/sales/${saleId}/payment`, { amount, method: payMethod });
      setSale({ ...sale, paidAmount: res.data.sale.paidAmount, balanceAmount: res.data.sale.balanceAmount, status: res.data.sale.status });
      setPayModal(false);
      setPayAmount('');
      toast.success('Payment recorded');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (loading) return <Loading text="Loading invoice..." />;
  if (!sale) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/invoices" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-semibold">Invoice {sale.invoiceNumber}</h1>
        <Badge status={sale.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="!p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-charcoal">{settings.shopName || 'Your Shop'}</h2>
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{settings.shopAddress || ''}</p>
                <p className="text-sm text-gray-500">{settings.shopPhone || ''}</p>
                <p className="text-sm text-gray-500">GST: {settings.shopGST || ''}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{sale.invoiceNumber}</div>
                <div className="text-sm text-gray-500">{formatDateTime(sale.createdAt)}</div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-xs uppercase text-gray-400 mb-1">Billed To</div>
              <div className="font-medium">{sale.customer?.name || 'Walk-in Customer'}</div>
              {sale.customer?.phone && <div className="text-sm text-gray-500">{sale.customer.phone}</div>}
              {sale.customer?.address && <div className="text-sm text-gray-500">{sale.customer.address}</div>}
              {sale.customer?.gstNumber && <div className="text-sm text-gray-500">GST: {sale.customer.gstNumber}</div>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left text-xs font-semibold uppercase text-gray-400">Item</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase text-gray-400">Weight</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase text-gray-400">Rate</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase text-gray-400">Making</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase text-gray-400">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items?.map((i: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3">
                        <div className="font-medium">{i.name}</div>
                        <div className="text-xs text-gray-400">{i.purity !== 100 ? `${i.purity}K` : 'Fine'} · {i.product?.itemCode || ''} {i.product?.huid ? `· HUID: ${i.product.huid}` : ''}</div>
                      </td>
                      <td className="py-3 text-right">{formatWeight(i.netWeight)}</td>
                      <td className="py-3 text-right">{formatMoney(i.rate)}</td>
                      <td className="py-3 text-right">{formatMoney(i.makingCharge)}</td>
                      <td className="py-3 text-right font-medium">{formatMoney(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 ml-auto w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatMoney(sale.totalAmount)}</span></div>
              {sale.discountTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{formatMoney(sale.discountTotal)}</span></div>}
              {sale.taxTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatMoney(sale.taxTotal)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span>{formatMoney(sale.grandTotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Paid</span><span>{formatMoney(sale.paidAmount)}</span></div>
              <div className="flex justify-between font-semibold"><span>Balance</span><span className={sale.balanceAmount > 0 ? 'text-amber-600' : 'text-green-600'}>{formatMoney(sale.balanceAmount)}</span></div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Payments">
            <div className="space-y-3">
              {sale.payments?.map((p: any) => (
                <div key={p.id} className="flex justify-between text-sm border-b pb-2">
                  <div>
                    <div className="font-medium">{formatMoney(p.amount)}</div>
                    <div className="text-xs text-gray-400">{p.method} · {formatDateTime(p.createdAt)}</div>
                  </div>
                  <div className="text-xs text-gray-400 self-center">{p.user?.name}</div>
                </div>
              ))}
              {(!sale.payments || sale.payments.length === 0) && <div className="text-sm text-gray-400 text-center py-2">No payments recorded</div>}
            </div>
            {sale.balanceAmount > 0 && (
              <button className="btn-primary w-full mt-4" onClick={() => setPayModal(true)}>
                Receive Payment
              </button>
            )}
          </Card>

          <Card title="Actions">
            <div className="space-y-2">
              <button className="btn-secondary w-full" onClick={() => window.print()}><Printer size={16} /> Print Invoice</button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={payModal}
        onClose={() => setPayModal(false)}
        title="Record Payment"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPayModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handlePayment}>Record Payment</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Amount (Balance: {formatMoney(sale.balanceAmount)})</label>
            <input type="number" className="input-field" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(sale.balanceAmount)} />
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