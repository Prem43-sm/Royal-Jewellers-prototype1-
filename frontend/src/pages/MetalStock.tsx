import React, { useEffect, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { MetalRate, formatMoney, formatDateTime } from '../lib/types';
import { Card, Modal, EmptyState } from '../components/ui';

export default function MetalStockPage() {
  const [rates, setRates] = useState<MetalRate[]>([]);
  const [ledger, setLedger] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [byType, setByType] = useState<any[]>([]);
  const [closingBalance, setClosingBalance] = useState(0);
  const [filterMetal, setFilterMetal] = useState('GOLD');
  const [filterPurity, setFilterPurity] = useState('');
  const [rateModal, setRateModal] = useState(false);
  const [newRate, setNewRate] = useState({ metal: 'GOLD', purity: '22', buyRate: '', sellRate: '' });
  const [stock, setStock] = useState<any>(null);

  useEffect(() => {
    fetchRates();
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [filterMetal, filterPurity]);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchRates = async () => {
    try {
      const res = await api.get('/metal-rates?limit=50');
      setRates(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await api.get('/reports/metal-ledger', { params: { metal: filterMetal, purity: filterPurity || undefined } });
      setMovements(res.data.movements);
      setByType(res.data.byType);
      setClosingBalance(res.data.closingBalance);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const fetchStock = async () => {
    try {
      const res = await api.get('/reports/stock');
      setStock(res.data);
    } catch {}
  };

  const addRate = async () => {
    try {
      await api.post('/metal-rates', {
        metal: newRate.metal,
        purity: parseFloat(newRate.purity),
        buyRate: parseFloat(newRate.buyRate),
        sellRate: parseFloat(newRate.sellRate),
      });
      setRateModal(false);
      setNewRate({ metal: 'GOLD', purity: '22', buyRate: '', sellRate: '' });
      toast.success('Rate added');
      fetchRates();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const groupRates = rates.reduce<Record<string, MetalRate[]>>((acc, r) => {
    const key = `${r.metal}-${r.purity}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const latestRates = Object.values(groupRates).map((rs) => rs[0]);

  const puritiesForMetal: Record<string, number[]> = {
    GOLD: [24, 22, 21, 18, 14, 9],
    SILVER: [100, 92],
    DIAMOND: [0],
    PLATINUM: [95],
    OTHER: [0],
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Metal Stock & Daily Rates</h2>
        <button className="btn-primary" onClick={() => setRateModal(true)}><Plus size={16} /> Set Today's Rate</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card title="Current Stock (IN_STOCK)">
            {stock && (
              <div className="space-y-3">
                {stock.byMetal.map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className={b.metal === 'GOLD' ? 'text-gold-dark' : 'text-gray-400'} />
                      <span className="text-sm font-medium">{b.metal}</span>
                    </div>
                    <span className="text-sm font-semibold">{b._sum.netWeight?.toFixed(3)}g</span>
                  </div>
                ))}
                {stock.byMetal.length === 0 && <div className="text-sm text-gray-400 text-center py-2">No stock</div>}
              </div>
            )}
          </Card>

          <Card title="Latest Rates">
            <div className="space-y-2">
              {latestRates.map((r) => (
                <div key={r.id} className="flex justify-between items-center p-2 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium">{r.metal}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.purity === 0 || r.purity === 100 ? '' : `${r.purity}K`}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400 text-xs">Buy {formatMoney(r.buyRate)} · </span>
                    <span className="text-gold-dark font-semibold">Sell {formatMoney(r.sellRate)}</span>
                  </div>
                </div>
              ))}
              {latestRates.length === 0 && <div className="text-sm text-gray-400 text-center">No rates set yet</div>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card title="Metal Ledger">
            <div className="flex gap-2 mb-4 flex-wrap">
              <select className="input-field !w-auto" value={filterMetal} onChange={(e) => { setFilterMetal(e.target.value); setFilterPurity(''); }}>
                {['GOLD', 'SILVER', 'DIAMOND', 'PLATINUM', 'OTHER'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="input-field !w-auto" value={filterPurity} onChange={(e) => setFilterPurity(e.target.value)}>
                <option value="">All Purity</option>
                {(puritiesForMetal[filterMetal] || []).map((p) => (
                  <option key={p} value={p}>{p === 100 || p === 0 ? 'Fine' : `${p}K`}</option>
                ))}
              </select>
              <div className="ml-auto font-semibold">
                Closing: <span className="text-gold-dark">{closingBalance.toFixed(3)}g</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="table-header">Date</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Weight</th>
                    <th className="table-header">Balance</th>
                    <th className="table-header">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="table-cell">{formatDateTime(m.createdAt)}</td>
                      <td className="table-cell font-medium">{m.movementType.replace(/_/g, ' ')}</td>
                      <td className="table-cell">{m.weight > 0 ? '+' : ''}{m.weight.toFixed(3)}g</td>
                      <td className="table-cell font-semibold">{m.runningBalance.toFixed(3)}g</td>
                      <td className="table-cell text-xs text-gray-400">{m.notes || (m.referenceType ? `${m.referenceType} #${m.referenceId}` : '-')}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && <tr><td colSpan={5} className="table-cell text-center text-gray-400">No movements recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Movements Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {byType.map((t: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{t._sum.weight?.toFixed(3)}g</div>
                  <div className="text-xs text-gray-400">{t.movementType.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={rateModal}
        onClose={() => setRateModal(false)}
        title="Set Today's Rate"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setRateModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={addRate}>Save Rate</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Metal</label>
            <select className="input-field" value={newRate.metal} onChange={(e) => setNewRate({ ...newRate, metal: e.target.value })}>
              {['GOLD', 'SILVER', 'DIAMOND', 'PLATINUM', 'OTHER'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Purity</label>
            <input className="input-field" type="number" min={0} max={24} value={newRate.purity} onChange={(e) => setNewRate({ ...newRate, purity: e.target.value })} />
          </div>
          <div>
            <label className="label">Buy Rate (₹/g)</label>
            <input className="input-field" type="number" value={newRate.buyRate} onChange={(e) => setNewRate({ ...newRate, buyRate: e.target.value })} />
          </div>
          <div>
            <label className="label">Sell Rate (₹/g)</label>
            <input className="input-field" type="number" value={newRate.sellRate} onChange={(e) => setNewRate({ ...newRate, sellRate: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}