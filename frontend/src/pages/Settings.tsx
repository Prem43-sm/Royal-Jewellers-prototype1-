import React, { useEffect, useState } from 'react';
import { Save, User as UserIcon, Plus, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Card, Loading } from '../components/ui';

const SHOP_FIELDS: { key: string; label: string }[] = [
  { key: 'shopName', label: 'Shop Name' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'gstNumber', label: 'GST Number' },
  { key: 'currency', label: 'Currency (default ₹)' },
];

const PRICING_FIELDS: { key: string; label: string }[] = [
  { key: 'defaultMakingPct', label: 'Default Making Charge %' },
  { key: 'defaultWastagePct', label: 'Default Wastage %' },
  { key: 'defaultTaxPct', label: 'Default Tax %' },
  { key: 'oldGoldDiscountPct', label: 'Old Gold Deduction %' },
  { key: 'ratePurity', label: 'Rate Basis Purity (e.g. 22 for 22K)' },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  shopName: 'Shree Jewellers',
  tagline: '',
  address: '',
  phone: '',
  email: '',
  gstNumber: '',
  currency: '₹',
  defaultMakingPct: '10',
  defaultWastagePct: '5',
  defaultTaxPct: '0',
  oldGoldDiscountPct: '2',
  ratePurity: '22',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'shop' | 'pricing' | 'users'>('shop');
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'STAFF' });

  useEffect(() => {
    const load = async () => {
      try {
        const [s, u] = await Promise.all([
          api.get('/settings'),
          api.get('/auth'),
        ]);
        setSettings({ ...DEFAULT_SETTINGS, ...s.data });
        setUsers(u.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error('Name, email and password are required');
      return;
    }
    try {
      await api.post('/auth', newUser);
      toast.success('User created');
      setNewUser({ name: '', email: '', password: '', role: 'STAFF' });
      const res = await api.get('/auth');
      setUsers(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const toggleUserStatus = async (u: any) => {
    try {
      await api.put(`/auth/${u.id}`, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      setUsers(users.map((x) => (x.id === u.id ? { ...x, status: x.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : x)));
      toast.success('User status updated');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const fields = activeTab === 'shop' ? SHOP_FIELDS : activeTab === 'pricing' ? PRICING_FIELDS : [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['shop', 'pricing', 'users'] as const).map((t) => (
          <button key={t} className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => setActiveTab(t)}>
            {t === 'users' ? 'Manage Users' : t === 'shop' ? 'Shop Details' : 'Pricing Defaults'}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading text="Loading settings..." />
      ) : (
        <>
          {activeTab !== 'users' && (
            <>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {fields.map((f) => (
                    <div key={f.key} className={f.key === 'address' || f.key === 'tagline' ? 'md:col-span-2' : ''}>
                      <label className="label">{f.label}</label>
                      <input
                        className="input-field"
                        value={settings[f.key] ?? ''}
                        onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <button className="btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}</button>
                </div>
              </Card>
              {activeTab === 'shop' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  Shop name, address, phone and GST appear on printed invoices.
                </div>
              )}
            </>
          )}

          {activeTab === 'users' && (
            <>
              <Card title="Create User">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div><label className="label">Name</label><input className="input-field" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
                  <div><label className="label">Email</label><input className="input-field" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                  <div><label className="label">Password</label><input className="input-field" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
                  <div>
                    <label className="label">Role</label>
                    <select className="input-field" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                      {['STAFF', 'MANAGER', 'OWNER'].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button className="btn-primary" onClick={createUser}><Plus size={16} /> Create User</button>
                </div>
              </Card>

              <Card className="!p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Name</th>
                        <th className="table-header">Email</th>
                        <th className="table-header">Role</th>
                        <th className="table-header">Status</th>
                        <th className="table-header text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="table-cell font-medium"><span className="inline-flex items-center gap-2"><UserIcon size={14} className="text-gray-400" /> {u.name}</span></td>
                          <td className="table-cell">{u.email}</td>
                          <td className="table-cell">
                            <span className={`badge ${u.role === 'OWNER' ? 'bg-gold-light text-gold-dark' : u.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{u.role}</span>
                          </td>
                          <td className="table-cell"><span className={`badge ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span></td>
                          <td className="table-cell text-right">
                            {u.role !== 'OWNER' && (
                              <button
                                className={`text-xs px-2 py-1 rounded ${u.status === 'ACTIVE' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                onClick={() => toggleUserStatus(u)}
                              >
                                {u.status === 'ACTIVE' ? <span className="inline-flex items-center gap-1"><Trash2 size={12} /> Deactivate</span> : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}