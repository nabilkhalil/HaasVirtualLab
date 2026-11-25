import { useEffect, useRef } from 'react';
import { Controller } from '../controller/Controller';
import { MachineScene } from '../machine/MachineScene';
import { SceneBoundary } from '../machine/SceneBoundary';
import { LessonPanel } from '../lessons/LessonPanel';
import { isTypingTarget, jogForKey } from '../app/shortcuts';
import { clampPanel, useUi } from '../store/uiStore';
import { useMachine } from '../store/machineStore';

/** The single shared simulator (machine engine + 3D + controller). Lazy-loaded by the app shell. */
export default function SimulatorPage() {
  const panelPct = useUi((s) => s.panelPct);
  const keysJog = useUi((s) => s.keysJog);
  const main = useRef<HTMLElement>(null);
  const dragging = useRef(false);

  // Arrow keys jog the selected axis; the controller divider keeps its own arrow handling.
  useEffect(() => {
    if (!keysJog) return;
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return;
      const j = jogForKey(e.key);
      if (!j) return;
      e.preventDefault();
      useMachine.getState().dispatch({ type: 'JOG', axis: j.axis, direction: j.dir });
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [keysJog]);

  const dragTo = (clientX: number) => {
    const r = main.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    useUi.getState().setPanel(((clientX - r.left) / r.width) * 100);
  };

  return (
    <main className="sim" ref={main} style={{ ['--left' as string]: `${panelPct}%` }}>
      <div className="left"><SceneBoundary><MachineScene /></SceneBoundary><LessonPanel /></div>
      <div
        className="split" role="separator" aria-orientation="vertical" tabIndex={0} data-testid="split"
        aria-label="Resize controller panel" aria-valuemin={45} aria-valuemax={85} aria-valuenow={panelPct}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (dragging.current) dragTo(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onDoubleClick={() => useUi.getState().setPanel(68)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          e.stopPropagation();
          useUi.getState().setPanel(clampPanel(panelPct + (e.key === 'ArrowLeft' ? -2 : 2)));
        }}
      />
      <Controller />
    </main>
  );
}
