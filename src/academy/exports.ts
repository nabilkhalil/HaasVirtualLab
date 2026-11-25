import type { Attempt, ModuleProgress } from '../store/progressStore';

export const BACKUP_APP = 'haas-virtual-lab';
export interface BackupData { modules: Record<string, ModuleProgress>; attempts: Attempt[]; hints: number; timeMs: number }

const esc = (v: unknown) => { const s = v === undefined || v === null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const CSV_HEADER = ['date', 'module', 'lesson', 'mode', 'score', 'max', 'percent', 'duration_s', 'correct_ops', 'incorrect', 'collisions', 'alarms', 'hints', 'seed', 'mistakes', 'items'];
/** CSV text. `header` lets the UI pass translated column names; values stay canonical for spreadsheet use. */
export function attemptsCSV(attempts: Attempt[], header: string[] = CSV_HEADER): string {
  const rows = attempts.map((a) => [new Date(a.at).toISOString(), a.moduleId ?? '', a.lessonId, a.mode, a.score, a.max, a.max ? Math.round((100 * a.score) / a.max) : '',
    a.durationMs !== undefined ? Math.round(a.durationMs / 1000) : '', a.ok ?? '', a.incorrect, a.collisions, a.alarms ?? '', a.hints, a.seed ?? '',
    Object.entries(a.mistakes ?? {}).map(([k, v]) => `${k}:${v}`).join('; '), (a.items ?? []).map((i) => `${i.label} ${i.points}/${i.max}`).join('; ')]);
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}
export function backupJSON(d: BackupData): string {
  return JSON.stringify({ app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), data: d }, null, 1);
}
/** Validates a backup file; throws with a readable message when it is not a Haas Virtual Lab backup. */
export function parseBackup(text: string): BackupData {
  let j: unknown;
  try { j = JSON.parse(text); } catch { throw new Error('Not a JSON file'); }
  const o = j as { app?: string; version?: number; data?: Partial<BackupData> };
  if (o?.app !== BACKUP_APP || o.version !== 1 || !o.data) throw new Error('Not a Haas Virtual Lab backup (v1)');
  const d = o.data;
  if (typeof d.modules !== 'object' || d.modules === null || !Array.isArray(d.attempts)) throw new Error('Backup is missing modules or attempts');
  for (const a of d.attempts) if (typeof a?.lessonId !== 'string' || typeof a.score !== 'number' || typeof a.max !== 'number' || typeof a.at !== 'number') throw new Error('Backup contains an invalid attempt record');
  return { modules: d.modules, attempts: d.attempts, hints: Number(d.hints) || 0, timeMs: Number(d.timeMs) || 0 };
}
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
