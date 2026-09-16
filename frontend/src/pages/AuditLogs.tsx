import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { AuditLog, formatDateTime } from '../lib/types';
import { Card, Loading, EmptyState, Pagination } from '../components/ui';

const ENTITIES = ['', 'PRODUCT', 'SALE', 'PURCHASE', 'CUSTOMER', 'SUPPLIER', 'USER', 'ORDER', 'JOB_WORK', 'REPAIR', 'EXPENSE', 'ACCOUNT', 'DOCUMENT', 'BACKUP', 'SETTINGS', 'OLD_GOLD', 'RATES'];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 30;

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await api.get('/audit-logs', { params: { page, pageSize, entity } });
        setLogs(res.data.logs);
        setTotal(res.data.total);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [page, entity]);

  const tryParse = (v?: string | null): any => {
    if (!v) return null;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <h2 className="text-lg font-semibold">Audit Logs</h2>
        <select className="input-field !w-auto !h-9 text-sm" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">All Entities</option>
          {ENTITIES.filter(Boolean).map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <Loading text="Loading audit logs..." />
      ) : logs.length === 0 ? (
        <Card><EmptyState title="No audit logs" message="Actions across the system are logged here for traceability" /></Card>
      ) : (
        <Card className="!p-0">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Time</th>
                  <th className="table-header">User</th>
                  <th className="table-header">Action</th>
                  <th className="table-header">Entity</th>
                  <th className="table-header">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const oldV = tryParse(l.oldValue);
                  const newV = tryParse(l.newValue);
                  return (
                    <tr key={l.id}>
                      <td className="table-cell whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                      <td className="table-cell">{l.user ? `${l.user.name}` : 'System'}<div className="text-xs text-gray-400">{l.user?.email}</div></td>
                      <td className="table-cell"><span className="badge bg-gold-light text-gold-dark">{l.action}</span></td>
                      <td className="table-cell">{l.entity}{l.recordId ? ` #${l.recordId}` : ''}</td>
                      <td className="table-cell text-xs text-gray-500 max-w-[240px]">
                        {typeof newV === 'object' && newV ? (
                          <span className="font-mono truncate block">{Object.keys(newV).slice(0, 3).map((k) => `${k}:${newV[k] != null ? String(newV[k]).slice(0, 20) : ''}`).join(', ')}</span>
                        ) : (
                          <span className="truncate block">{String(newV ?? l.oldValue ?? '-').slice(0, 80)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </Card>
      )}
    </div>
  );
}