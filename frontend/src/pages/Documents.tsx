import React, { useEffect, useState, useRef } from 'react';
import { Upload, Download, Trash2, FileText } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Document, formatDate, formatDateTime, DOC_CATEGORIES } from '../lib/types';
import { Card, Loading, EmptyState } from '../components/ui';

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocs();
  }, [category, search, refreshKey]);

  const fetchDocs = async () => {
    try {
      const res = await api.get('/documents', { params: { category, search } });
      setDocs(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('files', f);
    fd.append('category', category || 'OTHER');
    try {
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${files.length} document(s) uploaded`);
      setRefreshKey((k) => k + 1);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const download = async (doc: Document) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const remove = async (doc: Document) => {
    try {
      await api.delete(`/documents/${doc.id}`);
      toast.success('Document deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Documents</h2>
        <div className="flex gap-2">
          <select className="input-field !w-auto !h-9 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input className="input-field max-w-xs !h-9" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <Loading text="Loading documents..." />
      ) : docs.length === 0 ? (
        <Card><EmptyState title="No documents" message="Upload GST/bills/agreements for safekeeping" action={<button className="btn-primary" onClick={() => fileRef.current?.click()}>Upload Document</button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-gold-light text-gold"><FileText size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" title={d.name}>{d.name}</div>
                  <div className="text-xs text-gray-400">{formatSize(d.fileSize)} · {formatDate(d.createdAt)}</div>
                  <span className="badge bg-purple-100 text-purple-700 mt-1">{d.category}</span>
                  {d.description && <div className="text-xs text-gray-500 mt-1 truncate">{d.description}</div>}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn-secondary btn-sm flex-1" onClick={() => download(d)}><Download size={14} /> Download</button>
                <button className="btn-ghost btn-sm !text-red-500" onClick={() => remove(d)}><Trash2 size={14} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}