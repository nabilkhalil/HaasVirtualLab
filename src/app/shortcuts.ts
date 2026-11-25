/** Keyboard shortcuts: one pure mapping, shared by the simulator, the help overlay and the tests. */
export type JogKey = { axis: 'X' | 'Y' | 'Z'; dir: 1 | -1 };

/** Arrow keys jog the selected axis; PageUp/PageDown jog Y. */
export const JOG_KEYS: Record<string, JogKey> = {
  ArrowLeft: { axis: 'X', dir: -1 },
  ArrowRight: { axis: 'X', dir: 1 },
  ArrowUp: { axis: 'Z', dir: 1 },
  ArrowDown: { axis: 'Z', dir: -1 },
  PageUp: { axis: 'Y', dir: 1 },
  PageDown: { axis: 'Y', dir: -1 },
};

export const jogForKey = (key: string): JogKey | null => JOG_KEYS[key] ?? null;

/** Typing must never jog an axis or open overlays. */
export function isTypingTarget(t: EventTarget | null | undefined): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/** Global (page independent) shortcuts. Plain letters only when no modifier is held. */
export function globalShortcut(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; target?: EventTarget | null }): 'help' | 'fullscreen' | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  if (isTypingTarget(e.target ?? null)) return null;
  if (e.key === '?') return 'help';
  if (e.key === 'f' || e.key === 'F') return 'fullscreen';
  return null;
}

/** Shortcut rows for the help overlay; labels are translated by the caller. */
export const SHORTCUTS: { id: string; keys: string }[] = [
  { id: 'help', keys: '?' },
  { id: 'fullscreen', keys: 'F' },
  { id: 'escape', keys: 'Esc' },
  { id: 'jogX', keys: '← →' },
  { id: 'jogZ', keys: '↑ ↓' },
  { id: 'jogY', keys: 'PgUp PgDn' },
  { id: 'panel', keys: '← →' },
];

/** Fullscreen with a safe fallback: unsupported or refused simply does nothing. */
export async function toggleFullscreen(el?: HTMLElement): Promise<boolean> {
  // Resolved inside the try: without a DOM (unit tests) or with fullscreen disabled this must not throw.
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); return false; }
    const target = el ?? document.documentElement;
    if (!target.requestFullscreen) return false;
    await target.requestFullscreen();
    return true;
  } catch { return false; }
}
