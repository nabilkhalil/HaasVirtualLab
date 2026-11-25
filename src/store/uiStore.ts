import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Display preferences (LocalStorage). Panel width is the 3D/controller split in the simulator. */
export const MIN_PANEL = 45;
export const MAX_PANEL = 85;
export const clampPanel = (p: number) => (Number.isFinite(p) ? Math.min(MAX_PANEL, Math.max(MIN_PANEL, Math.round(p))) : 68);

interface UiState {
  panelPct: number;
  keysJog: boolean;
  setPanel: (p: number) => void;
  setKeysJog: (on: boolean) => void;
}

export const useUi = create<UiState>()(persist((set) => ({
  panelPct: 68,
  keysJog: true,
  setPanel: (p) => set({ panelPct: clampPanel(p) }),
  setKeysJog: (keysJog) => set({ keysJog }),
}), { name: 'hvl-ui', version: 1 }));
