import { create } from 'zustand';
import { UMC500 } from '../config/umc500';
import { initialState, reduce, type Action, type MachineState } from '../engine/machine';

export interface Store { state: MachineState; dispatch: (a: Action) => void; replace: (s: MachineState) => void }

export const useMachine = create<Store>((set) => ({
  state: initialState(UMC500),
  dispatch: (a) => set((st) => ({ state: reduce(st.state, a, UMC500) })),
  replace: (state) => set({ state }),
}));
