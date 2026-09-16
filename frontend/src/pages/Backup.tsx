import React, { useEffect, useState } from 'react';
import { DatabaseBackup, Download, Trash2, RefreshCw } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { formatDateTime } from '../lib/types';
import { Card, Loading, EmptyState, ConfirmDialog } from '../components/ui';

export default function BackupPage() {
  const [backups, setBackups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ action: 'restore' | 'delete'; backup: any } | null>(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const res = await api.get('/backup/list');
      setBackups(res.data.backups);
      setTotal(res.data.total);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.post('/backup/create', { notes: '' });
      toast.success(`Backup created: ${res.data.fileName}`);
      fetchBackups();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const download = async (b: any) => {
    try {
      const res = await api.get(`/backup/${b.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = b.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const doAction = async () => {
    if (!confirmTarget) return;
    const { action, backup } = confirmTarget;
    try {
      if (action === 'restore') {
        await api.post(`/backup/restore/${backup.id}`);
        toast.success('Backup restored. Restart server to apply.');
      } else {
        await api.delete(`/backup/${backup.id}`);
        toast.success('Backup deleted');
        fetchBackups();
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setConfirmTarget(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Backup & Restore</h2>
          <p className="text-sm text-gray-400">{total} backup(s) saved</p>
        </div>
        <button className="btn-primary" onClick={create} disabled={creating}>
          <DatabaseBackup size={16} /> {creating ? 'Creating...' : 'Create Backup Now'}
        </button>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        Backups create a copy of the SQLite database file. Restore replaces the current database; restart the server to complete restoration.
      </div>

      {loading ? (
        <Loading text="Loading backups..." />
      ) : backups.length === 0 ? (
        <Card><EmptyState title="No backups yet" message="Create your first database backup with the button above" action={<button className="btn-primary" onClick={create}>Create Backup Now</button>} /></Card>
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">File</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Size</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td className="table-cell font-mono text-sm">{b.fileName}</td>
                    <td className="table-cell">{formatDateTime(b.createdAt)}</td>
                    <td className="table-cell">{formatSize(b.fileSize)}</td>
                    <td className="table-cell text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn-secondary btn-sm" onClick={() => download(b)}><Download size={14} /> Download</button>
                        <button className="btn-secondary btn-sm !text-amber-600" onClick={() => setConfirmTarget({ action: 'restore', backup: b })}><RefreshCw size={14} /> Restore</button>
                        <button className="btn-ghost btn-sm !text-red-500" onClick={() => setConfirmTarget({ action: 'delete', backup: b })}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={doAction}
        title={confirmTarget?.action === 'restore' ? 'Restore this backup?' : 'Delete this backup?'}
        message={
          confirmTarget?.action === 'restore'
            ? 'Current database will be replaced. This cannot be undone. Avoid doing this while other users are active.'
            : 'The backup file will be permanently removed from the server.'
        }
        confirmText={confirmTarget?.action === 'restore' ? 'Restore' : 'Delete'}
      />
    </div>
  );
}