import { create } from 'zustand';
import api from '../lib/api';

interface SettingsState {
  settings: Record<string, string>;
  fetch: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {},
  fetch: async () => {
    try {
      const res = await api.get('/settings');
      set({ settings: res.data });
    } catch {}
  },
}));