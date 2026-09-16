import React from 'react';
import { XCircle } from 'lucide-react';

export function Card({ title, children, className = '', action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="card-title !mb-0">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, accent = 'gold' }: { icon: any; label: string; value: string | number; sub?: string; accent?: string }) {
  const accents: Record<string, string> = {
    gold: 'bg-gold-light text-gold-dark',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accents[accent] || accents.gold}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold truncate">{value}</div>
        <div className="text-sm text-gray-500 truncate">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    IN_STOCK: 'bg-green-100 text-green-700',
    SOLD: 'bg-blue-100 text-blue-700',
    RESERVED: 'bg-amber-100 text-amber-700',
    CUSTOM_ORDER: 'bg-purple-100 text-purple-700',
    REPAIR: 'bg-orange-100 text-orange-700',
    JOB_WORK: 'bg-indigo-100 text-indigo-700',
    RETURNED: 'bg-teal-100 text-teal-700',
    DAMAGED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    PARTIAL: 'bg-amber-100 text-amber-700',
    QUOTATION: 'bg-gray-100 text-gray-700',
    ADVANCE_RECEIVED: 'bg-blue-100 text-blue-700',
    DESIGN_APPROVED: 'bg-indigo-100 text-indigo-700',
    MANUFACTURING: 'bg-purple-100 text-purple-700',
    READY: 'bg-amber-100 text-amber-700',
    DELIVERED: 'bg-green-100 text-green-700',
    ISSUED: 'bg-blue-100 text-blue-700',
    PARTIAL_RETURN: 'bg-amber-100 text-amber-700',
    RECEIVED: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-red-100 text-red-700',
  };
  const pretty = status.replace(/_/g, ' ');
  return <span className={`badge ${colors[status] || 'bg-gray-100 text-gray-700'}`}>{pretty}</span>;
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-modal w-full ${widths[size]} max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <XCircle size={22} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message = 'This action cannot be undone.', confirmText = 'Confirm' }: { open: boolean; onClose: () => void; onConfirm: () => void; title?: string; message?: string; confirmText?: string }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title = 'No data found', message = 'There are no records to display yet.', action }: { title?: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-300 text-2xl">◈</div>
      <h3 className="text-base font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-400 mt-1 mb-4">{message}</p>
      {action}
    </div>
  );
}

export function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-gold/30 border-t-gold rounded-full animate-spin" />
        <p className="text-sm text-gray-500">{text}</p>
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
      <span className="text-gray-500">
        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
        <button className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
      </svg>
      <input
        className="input-field !pl-9 bg-gray-50"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}