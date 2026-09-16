import { create } from 'zustand';
import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (type: Toast['type'], message: string) => void;
  remove: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  warning: (m: string) => useToastStore.getState().push('warning', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();
  return (
    <div className="toast-container">
      {toasts.map((t) => {
        const icons = {
          success: <CheckCircle size={18} className="text-green-500" />,
          error: <XCircle size={18} className="text-red-500" />,
          warning: <AlertTriangle size={18} className="text-amber-500" />,
          info: <Info size={18} className="text-blue-500" />,
        };
        const colors = {
          success: 'border-green-200',
          error: 'border-red-200',
          warning: 'border-amber-200',
          info: 'border-blue-200',
        };
        return (
          <div key={t.id} className={`bg-white border ${colors[t.type]} rounded-lg shadow-dropdown px-4 py-3 flex items-start gap-3 min-w-[280px] max-w-sm animate-[slideIn_0.3s_ease-out]`}>
            <div className="mt-0.5 shrink-0">{icons[t.type]}</div>
            <div className="text-sm text-charcoal flex-1">{t.message}</div>
            <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}