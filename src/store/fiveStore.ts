import { create } from 'zustand';
import type { V3 } from '../engine/fiveaxis';

export interface TcpcDemo { from: V3; to: V3; B: [number, number]; C: [number, number] }
interface FiveStore {
  demo: TcpcDemo; showPaths: boolean; face: string; point: V3; showPivots: boolean;
  set: (p: Partial<Omit<FiveStore, 'set'>>) => void;
}
export const DEFAULT_DEMO: TcpcDemo = { from: [-40, 0, 10], to: [40, 0, 10], B: [0, 30], C: [0, 0] };
export const useFive = create<FiveStore>((set) => ({
  demo: DEFAULT_DEMO, showPaths: false, face: 'Top', point: [0, 0, 5], showPivots: true,
  set: (p) => set(p),
}));
