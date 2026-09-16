import React, { useEffect, useState } from 'react';
import { Plus, Building2, Wallet, Receipt } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { formatMoney, formatDateTime, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../lib/types';
import { Card, Modal, Loading, EmptyState } from '../components/ui';

export default function AccountsPage() {
  const [tab, setTab] = useState<'accounts' | 'expenses' | 'transactions'>('accounts');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [viewAccount, setViewAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [accountForm, setAccountForm] = useState({ name: '', type: 'BANK' });
  const [expenseForm, setExpenseForm] = useState({ date: new Date().toISOString().slice(0, 10), category: 'RENT', description: '', amount: '', paymentMethod: 'CASH', notes: '' });

  useEffect(() => {
    setLoading(true);
    const fetchAccounts = async () => {
      try {
        const res = await api.get('/accounts');
        setAccounts(res.data);
      } catch {}
    };
    const fetchExpenses = async () => {
      try {
        const res = await api.get('/reports/expenses');
        setExpenses(res.data.expenses);
        setExpenseTotal(res.data.total);
      } catch {}
    };
    Promise.all([fetchAccounts(), fetchExpenses()]).finally(() => setLoading(false));
  }, [refreshKey]);

  const createAccount = async () => {
    if (!accountForm.name.trim()) {
      toast.error('Account name is required');
      return;
    }
    try {
      await api.post('/accounts', accountForm);
      toast.success('Account created');
      setAccountOpen(false);
      setAccountForm({ name: '', type: 'BANK' });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const createExpense = async () => {
    const amount = parseFloat(expenseForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await api.post('/expenses', {
        ...expenseForm,
        amount,
        date: expenseForm.date || undefined,
      });
      toast.success('Expense recorded');
      setExpenseOpen(false);
      setRefreshKey((k) => k + 1);
      setExpenseForm({ date: new Date().toISOString().slice(0, 10), category: 'RENT', description: '', amount: '', paymentMethod: 'CASH', notes: '' });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const openTransactions = async (account: any) => {
    try {
      const res = await api.get(`/accounts/${account.id}/transactions`);
      setTransactions(res.data);
      setViewAccount(account);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['accounts', 'expenses', 'transactions'] as const).map((t) => (
            <button
              key={t}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === t ? 'bg-white shadow' : 'text-gray-500'}`}
              onClick={() => setTab(t)}
            >
              {t === 'accounts' ? 'Accounts' : t === 'expenses' ? 'Expenses' : 'Transactions'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'accounts' && <button className="btn-primary" onClick={() => setAccountOpen(true)}><Building2 size={16} /> Add Account</button>}
          {tab === 'expenses' && <button className="btn-primary" onClick={() => setExpenseOpen(true)}><Plus size={16} /> Add Expense</button>}
        </div>
      </div>

      {loading ? (
        <Loading text="Loading..." />
      ) : (
        <>
          {tab === 'accounts' && (
            accounts.length === 0 ? (
              <Card><EmptyState title="No accounts" message="Add accounts (cash, banks) to track balances" /></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((a) => (
                  <Card key={a.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet size={18} className="text-gold" />
                        <div>
                          <div className="font-semibold">{a.name}</div>
                          <div className="text-xs text-gray-400 capitalize">{a.type}</div>
                        </div>
                      </div>
                      <button className="text-xs text-gold-dark hover:underline" onClick={() => openTransactions(a)}>
                        {a._count?.transactions || 0} txns
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {tab === 'expenses' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><div className="text-2xl font-bold text-gold">{formatMoney(expenseTotal)}</div><div className="text-xs text-gray-400">Total Expenses</div></Card>
                <Card><div className="text-2xl font-bold">{expenses.filter((e) => new Date(e.date).getMonth() === new Date().getMonth()).length}</div><div className="text-xs text-gray-400">This Month Count</div></Card>
                <Card><div className="text-2xl font-bold">{EXPENSE_CATEGORIES.length}</div><div className="text-xs text-gray-400">Categories</div></Card>
              </div>
              <Card className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Date</th>
                        <th className="table-header">Category</th>
                        <th className="table-header">Description</th>
                        <th className="table-header">Method</th>
                        <th className="table-header text-right">Amount</th>
                        <th className="table-header">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id}>
                          <td className="table-cell">{formatDateTime(e.date)}</td>
                          <td className="table-cell"><span className="badge bg-purple-100 text-purple-700">{e.category}</span></td>
                          <td className="table-cell">{e.description || '-'}</td>
                          <td className="table-cell">{e.paymentMethod}</td>
                          <td className="table-cell text-right font-medium text-red-600">-{formatMoney(e.amount)}</td>
                          <td className="table-cell">{e.user?.name || '-'}</td>
                        </tr>
                      ))}
                      {expenses.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-gray-400">No expenses recorded</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {tab === 'transactions' && (
            <Card className="!p-0 overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2"><Receipt size={16} className="text-gold" /> <span className="font-medium">All Account Transactions</span></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Date</th>
                      <th className="table-header">Account</th>
                      <th className="table-header">Type</th>
                      <th className="table-header">Description</th>
                      <th className="table-header text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <React.Fragment key={a.id}>
                        {transactions.length === 0 && (
                          <tr><td colSpan={5} className="table-cell text-center text-gray-400">Click an account to view its transactions</td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title="Add Account"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAccountOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createAccount}>Create</button>
          </>
        }
      >
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input-field" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} /></div>
          <div><label className="label">Type</label>
            <select className="input-field" value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>
              {['BANK', 'CASH', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Add Expense"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setExpenseOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createExpense}>Record Expense</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Date</label><input className="input-field" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></div>
          <div><label className="label">Category</label>
            <select className="input-field" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="label">Description *</label><input className="input-field" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>
          <div><label className="label">Amount (₹) *</label><input className="input-field" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div>
          <div><label className="label">Method</label>
            <select className="input-field" value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="label">Notes</label><input className="input-field" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal
        open={!!viewAccount}
        onClose={() => setViewAccount(null)}
        title={viewAccount ? `${viewAccount.name} · Transactions` : ''}
        size="lg"
        footer={<button className="btn-primary" onClick={() => setViewAccount(null)}>Close</button>}
      >
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Type</th>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="table-cell">{formatDateTime(t.createdAt)}</td>
                  <td className="table-cell">{t.type}</td>
                  <td className="table-cell">{t.description || '-'}</td>
                  <td className={`table-cell text-right font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{t.amount > 0 ? '+' : ''}{formatMoney(t.amount)}</td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={4} className="table-cell text-center text-gray-400">No transactions</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}