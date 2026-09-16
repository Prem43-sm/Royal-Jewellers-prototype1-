import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { formatMoney, formatWeight, formatDate, METALS } from '../lib/types';
import { Card, Loading, EmptyState, SearchInput } from '../components/ui';

export default function ReportsPage() {
  const [active, setActive] = useState('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any>(null);
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [profitData, setProfitData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerMetal, setLedgerMetal] = useState('GOLD');
  const [oldGoldData, setOldGoldData] = useState<any>(null);
  const [custOutData, setCustOutData] = useState<any>(null);
  const [suppOutData, setSuppOutData] = useState<any>(null);
  const [paymentsData, setPaymentsData] = useState<any>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (from) params.from = from;
      if (to) params.to = to;

      if (active === 'sales') setSalesData((await api.get('/reports/sales', { params })).data);
      if (active === 'purchases') setPurchaseData((await api.get('/reports/purchases', { params })).data);
      if (active === 'profit') setProfitData((await api.get('/reports/profit', { params })).data);
      if (active === 'expenses') setExpenseData((await api.get('/reports/expenses', { params })).data);
      if (active === 'stock') setStockData((await api.get('/reports/stock')).data);
      if (active === 'metal-ledger') setLedgerData((await api.get('/reports/metal-ledger', { params: { metal: ledgerMetal } })).data);
      if (active === 'old-gold') setOldGoldData((await api.get('/reports/old-gold', { params })).data);
      if (active === 'cust-outstanding') setCustOutData((await api.get('/reports/customer-outstanding')).data);
      if (active === 'supp-outstanding') setSuppOutData((await api.get('/reports/supplier-outstanding')).data);
      if (active === 'payments') setPaymentsData((await api.get('/reports/payments', { params })).data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ledgerMetal]);

  const tabs = [
    ['sales', 'Sales'], ['purchases', 'Purchases'], ['profit', 'Profit & Loss'], ['expenses', 'Expenses'],
    ['stock', 'Stock'], ['metal-ledger', 'Metal Ledger'], ['old-gold', 'Old Gold'],
    ['cust-outstanding', 'Customer Dues'], ['supp-outstanding', 'Supplier Dues'], ['payments', 'Payments'],
  ];

  const SummaryCards = ({ items }: { items: [string, number | string][] }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      {items.map(([label, value]) => (
        <Card key={label}><div className="text-xl font-bold text-gold">{value}</div><div className="text-xs text-gray-400">{label}</div></Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {tabs.map(([key, label]) => (
            <button key={key} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${active === key ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setActive(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input-field !w-auto !h-8 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" className="input-field !w-auto !h-8 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn-primary btn-sm" onClick={fetch}>Apply</button>
        </div>
      </div>

      {active === 'metal-ledger' && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Metal:</label>
          <select className="input-field !w-auto !h-8 text-sm" value={ledgerMetal} onChange={(e) => setLedgerMetal(e.target.value)}>
            {METALS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <Loading text="Loading report..." />
      ) : (
        <>
          {active === 'sales' && salesData && (
            <>
              <SummaryCards items={[
                ['Total Sales', formatMoney(salesData.summary.totalSales)],
                ['Discount', formatMoney(salesData.summary.totalDiscount)],
                ['Tax', formatMoney(salesData.summary.totalTax)],
                ['Profit', salesData.summary.totalProfit === null ? 'Locked' : formatMoney(salesData.summary.totalProfit)],
              ]} />
              <SalesTable rows={salesData.sales} />
            </>
          )}

          {active === 'purchases' && purchaseData && (
            <>
              <SummaryCards items={[
                ['Total Purchases', formatMoney(purchaseData.summary.totalPurchases)],
                ['Paid', formatMoney(purchaseData.summary.totalPaid)],
                ['Balance', formatMoney(purchaseData.summary.totalBalance)],
                ['Count', purchaseData.summary.count],
              ]} />
              <Card className="!p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Purchase #</th><th className="table-header">Date</th><th className="table-header">Supplier</th><th className="table-header text-right">Total</th><th className="table-header text-right">Balance</th></tr></thead>
                    <tbody>
                      {purchaseData.purchases.map((p: any) => (
                        <tr key={p.id}><td className="table-cell font-medium">{p.purchaseNumber}</td><td className="table-cell">{formatDate(p.createdAt)}</td><td className="table-cell">{p.supplier?.name}</td><td className="table-cell text-right font-medium">{formatMoney(p.totalCost)}</td><td className="table-cell text-right">{formatMoney(p.balanceAmount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {active === 'profit' && profitData && (
            <>
              <SummaryCards items={[
                ['Gross Sales', formatMoney(profitData.grossSales)],
                ['Gross Profit', formatMoney(profitData.grossProfit)],
                ['Expenses', formatMoney(profitData.totalExpenses)],
                ['Net Profit', formatMoney(profitData.netProfit)],
              ]} />
              <Card>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gold to-gold-dark text-white">
                  <span className="font-medium">Net Profit (after expenses)</span>
                  <span className="text-2xl font-bold">{formatMoney(profitData.netProfit)}</span>
                </div>
              </Card>
            </>
          )}

          {active === 'expenses' && expenseData && (
            <>
              <SummaryCards items={[['Total Expenses', formatMoney(expenseData.total)], ['Records', expenseData.expenses.length]]} />
              <Card className="!p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Date</th><th className="table-header">Category</th><th className="table-header">Description</th><th className="table-header text-right">Amount</th></tr></thead>
                    <tbody>
                      {expenseData.expenses.map((e: any) => (
                        <tr key={e.id}><td className="table-cell">{formatDate(e.date)}</td><td className="table-cell">{e.category}</td><td className="table-cell">{e.description}</td><td className="table-cell text-right font-medium text-red-600">-{formatMoney(e.amount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {active === 'stock' && stockData && (
            <>
              <SummaryCards items={stockData.byMetal.map((m: any) => [`${m.metal} Stock`, formatWeight(m._sum.netWeight)])} />
              <Card className="!p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Item</th><th className="table-header">Category</th><th className="table-header">Metal</th><th className="table-header">Purity</th><th className="table-header text-right">Net Weight</th><th className="table-header text-right">Fine Gold</th></tr></thead>
                    <tbody>
                      {stockData.products.map((p: any) => (
                        <tr key={p.id}><td className="table-cell font-medium">{p.itemCode} · {p.name}</td><td className="table-cell">{p.category?.name || '-'}</td><td className="table-cell">{p.metal}</td><td className="table-cell">{p.purity !== 100 ? `${p.purity}K` : 'Fine'}</td><td className="table-cell text-right">{formatWeight(p.netWeight)}</td><td className="table-cell text-right">{formatWeight(p.fineGoldWeight)}</td></tr>
                      ))}
                      {stockData.products.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-gray-400">No stock</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {active === 'metal-ledger' && ledgerData && (
            <>
              <SummaryCards items={[
                ['Closing Balance', formatWeight(ledgerData.closingBalance)],
                ...ledgerData.byType.map((m: any) => [`${m.movementType}`, formatWeight(m._sum.weight)]),
              ]} />
              <Card className="!p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Date</th><th className="table-header">Type</th><th className="table-header">Ref</th><th className="table-header text-right">Weight</th><th className="table-header text-right">Balance</th></tr></thead>
                    <tbody>
                      {ledgerData.movements.map((m: any) => (
                        <tr key={m.id}><td className="table-cell">{formatDate(m.createdAt)}</td><td className="table-cell">{m.movementType}</td><td className="table-cell">{m.reference}</td><td className={`table-cell text-right font-medium ${m.weight > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.weight > 0 ? '+' : ''}{formatWeight(m.weight)}</td><td className="table-cell text-right">{formatWeight(m.runningBalance)}</td></tr>
                      ))}
                      {ledgerData.movements.length === 0 && <tr><td colSpan={5} className="table-cell text-center text-gray-400">No movements</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {active === 'old-gold' && oldGoldData && (
            <>
              <SummaryCards items={[
                ['Gross Weight', formatWeight(oldGoldData.summary.totalGrossWeight)],
                ['Fine Gold', formatWeight(oldGoldData.summary.totalFineWeight)],
                ['Total Value', formatMoney(oldGoldData.summary.totalValue)],
              ]} />
              <Card className="!p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Date</th><th className="table-header">Customer</th><th className="table-header text-right">Gross</th><th className="table-header text-right">Net</th><th className="table-header text-right">Fine</th><th className="table-header text-right">Value</th></tr></thead>
                    <tbody>
                      {oldGoldData.exchanges.map((x: any) => (
                        <tr key={x.id}><td className="table-cell">{formatDate(x.createdAt)}</td><td className="table-cell">{x.customer?.name || '-'}</td><td className="table-cell text-right">{formatWeight(x.grossWeight)}</td><td className="table-cell text-right">{formatWeight(x.netWeight)}</td><td className="table-cell text-right">{formatWeight(x.fineGoldWeight)}</td><td className="table-cell text-right font-medium">{formatMoney(x.finalValue)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {active === 'cust-outstanding' && custOutData && (
            <OutstandingTable
              title="Customer Outstanding"
              data={custOutData.customers}
              total={custOutData.totalOutstanding}
              type="customer"
            />
          )}

          {active === 'supp-outstanding' && suppOutData && (
            <OutstandingTable
              title="Supplier Outstanding"
              data={suppOutData.suppliers}
              total={suppOutData.totalOutstanding}
              type="supplier"
            />
          )}

          {active === 'payments' && paymentsData && (
            <div className="space-y-4">
              <Card title="Sale Payments">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Date</th><th className="table-header">Invoice</th><th className="table-header">Method</th><th className="table-header text-right">Amount</th><th className="table-header">By</th></tr></thead>
                    <tbody>
                      {paymentsData.salePayments.map((p: any) => (
                        <tr key={p.id}><td className="table-cell">{formatDate(p.createdAt)}</td><td className="table-cell">{p.sale?.invoiceNumber}</td><td className="table-cell">{p.method}</td><td className="table-cell text-right font-medium text-green-600">+{formatMoney(p.amount)}</td><td className="table-cell">{p.user?.name}</td></tr>
                      ))}
                      {paymentsData.salePayments.length === 0 && <tr><td colSpan={5} className="table-cell text-center text-gray-400">No sale payments</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Customer Payments">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Date</th><th className="table-header">Customer</th><th className="table-header">Method</th><th className="table-header text-right">Amount</th><th className="table-header">By</th></tr></thead>
                    <tbody>
                      {paymentsData.customerPayments.map((p: any) => (
                        <tr key={p.id}><td className="table-cell">{formatDate(p.createdAt)}</td><td className="table-cell">{p.customer?.name}</td><td className="table-cell">{p.method}</td><td className="table-cell text-right font-medium text-green-600">+{formatMoney(p.amount)}</td><td className="table-cell">{p.user?.name}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Supplier Payments">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr><th className="table-header">Date</th><th className="table-header">Supplier</th><th className="table-header">Method</th><th className="table-header text-right">Amount</th><th className="table-header">By</th></tr></thead>
                    <tbody>
                      {paymentsData.supplierPayments.map((p: any) => (
                        <tr key={p.id}><td className="table-cell">{formatDate(p.createdAt)}</td><td className="table-cell">{p.supplier?.name}</td><td className="table-cell">{p.method}</td><td className="table-cell text-right font-medium text-red-600">-{formatMoney(p.amount)}</td><td className="table-cell">{p.user?.name}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SalesTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <Card><EmptyState title="No sales in range" /></Card>;
  return (
    <Card className="!p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Invoice</th><th className="table-header">Date</th><th className="table-header">Customer</th>
              <th className="table-header text-right">Items</th><th className="table-header text-right">Total</th><th className="table-header text-right">Discount</th>
              <th className="table-header text-right">Tax</th><th className="table-header text-right">Balance</th><th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: any) => (
              <tr key={s.id}>
                <td className="table-cell font-medium">{s.invoiceNumber}</td>
                <td className="table-cell">{formatDate(s.createdAt)}</td>
                <td className="table-cell">{s.customer?.name || '-'}</td>
                <td className="table-cell text-right">{s.items?.length || 0}</td>
                <td className="table-cell text-right font-medium">{formatMoney(s.grandTotal)}</td>
                <td className="table-cell text-right">{formatMoney(s.discountTotal)}</td>
                <td className="table-cell text-right">{formatMoney(s.taxTotal)}</td>
                <td className="table-cell text-right">{formatMoney(s.balanceAmount)}</td>
                <td className="table-cell">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OutstandingTable({ title, data, total, type }: { title: string; data: any[]; total: number; type: 'customer' | 'supplier' }) {
  return (
    <div className="space-y-4">
      <Card><div className="text-2xl font-bold text-gold">{formatMoney(total)}</div><div className="text-xs text-gray-400">Total {title}</div></Card>
      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th><th className="table-header">Phone</th>
                <th className="table-header text-right">{type === 'customer' ? 'Total Sales' : 'Total Purchases'}</th>
                <th className="table-header text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r: any) => (
                <tr key={r.id}>
                  <td className="table-cell font-medium">{r.name}</td>
                  <td className="table-cell">{r.phone || '-'}</td>
                  <td className="table-cell text-right">{formatMoney(type === 'customer' ? r.totalSales : r.totalPurchases)}</td>
                  <td className="table-cell text-right text-amber-600 font-semibold">{formatMoney(r.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}