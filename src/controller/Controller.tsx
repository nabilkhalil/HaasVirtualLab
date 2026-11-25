import { AXES, UMC500, type Axis } from '../config/umc500';
import { useMachine } from '../store/machineStore';
import { useState } from 'react';
import { WCS } from '../config/workholding';
import { coords } from '../engine/coords';
import { explain } from '../engine/explain';
import { MeasureAndCheck, OffsetScreen, ToolLibrary, WorkOffsetScreen } from './ToolScreens';
import { CoordPanel, WorkholdingPanel } from './SetupPanels';
import { FiveAxisPanel } from './FiveAxisPanel';
import { useT } from '../i18n';
import { Keypad } from './Keypad';

/** S1 jog increment key labels; metric value per click shown below. */
const INC_LABEL: Record<number, string> = { 0.001: '.0001/.1', 0.01: '.001/1.', 0.1: '.01/10.', 1: '.1/100.' };

const fmt = (a: Axis, v: number) => (a === 'B' || a === 'C' ? v.toFixed(3) + '°' : v.toFixed(3));
/** Controls not implemented / not verified in Phase 1. Rendered disabled. */
const DISABLED = ['POWER UP', 'MEMORY', 'MDI', 'EDIT', 'CYCLE START', 'FEED HOLD', 'SINGLE BLOCK'];

export function Controller() {
  const { state: s, dispatch } = useMachine();
  const [tab, setTab] = useState<'CONTROL' | 'SETUP' | '5AXIS'>('CONTROL');
  const t = useT();
  const c = coords(s, UMC500);
  return (
    <div className="ctrl">
      <div className="row ctabs">
        {(['CONTROL', 'SETUP', '5AXIS'] as const).map((x) => <button key={x} data-testid={`tab-${x}`} className={tab === x ? 'on' : ''} onClick={() => setTab(x)} title={x === 'CONTROL' ? t('ctrl.keysNote') : undefined}>{t(`tab.${x}`)}</button>)}
      </div>
      {tab === 'SETUP' ? <><WorkholdingPanel /><ToolLibrary /></> : tab === '5AXIS' ? <FiveAxisPanel /> : <>
      <div className="screen" data-testid="screen">
        <div className="hdr">
          <span data-testid="mode">MODE: {s.mode === 'HANDLE_JOG' ? 'HANDLE JOG' : s.mode === 'ZERO_RETURN' ? 'SETUP:ZERO' : 'MDI (simulated)'}{s.comp !== 'G43' ? ` · ${s.comp}` : ''}</span>
          <span className={s.alarms.length ? 'alarm' : 'ok'} data-testid="status">
            {s.estopPressed ? 'E-STOP' : s.alarms.length ? 'ALARM' : 'READY'}
          </span>
        </div>
        {s.screen === 'POSITION' ? (
          <table className="pos">
          <caption>POSITION — WORK ({s.activeWcs}) · MACHINE (mm / deg)</caption>
          <tbody>
            {AXES.map((a) => (
              <tr key={a} className={a === s.selectedAxis ? 'sel' : ''}>
                <th>{a}</th>
                <td data-testid={`work-pos-${a}`} className="wp">{a in c.work ? fmt(a, c.work[a as 'X']) : fmt(a, s.machine[a] - s.work[s.activeWcs][a])}</td>
                <td data-testid={`pos-${a}`}>{fmt(a, s.machine[a])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        ) : s.offsetTab === 'WORK' ? <WorkOffsetScreen /> : <OffsetScreen />}
        <div className="info">Axis: {s.selectedAxis} · Increment: {s.jogIncrement} mm · T{s.activeTool} in spindle{s.screen === 'POSITION' && s.input ? ` · > ${s.input}` : ''}</div>
        <div className="msg" data-testid="message">
          {s.alarms.map((x) => `${x.code} ${x.text}`).join(' | ')} {s.message}
        </div>
        {explain(s.message) && <div className="why" data-testid="why">Why: {explain(s.message)}</div>}
      </div>

      <div className="keys">
        <div className="row">
          <span className="small">Active work offset (simulated MDI):</span>
          {WCS.map((w) => <button key={w} data-testid={`wcs-${w}`} className={s.activeWcs === w ? 'on' : ''} onClick={() => dispatch({ type: 'SET_WCS', wcs: w })}>{w}</button>)}
        </div>
        <div className="row">
          {(['POSITION', 'OFFSET'] as const).map((k) => (
            <button key={k} className={s.screen === k ? 'on' : ''} data-testid={`key-${k}`} onClick={() => dispatch({ type: 'KEY', key: k })}>{k}</button>
          ))}
        </div>
        <div className="row">
          <button
            className={'estop' + (s.estopPressed ? ' down' : '')}
            data-testid="estop"
            onClick={() => dispatch({ type: s.estopPressed ? 'ESTOP_RELEASE' : 'ESTOP_PRESS' })}
          >
            {s.estopPressed ? 'RELEASE E-STOP' : 'E-STOP'}
          </button>
          <button className="reset" data-testid="reset" onClick={() => dispatch({ type: 'RESET' })}>RESET</button>
        </div>
        <div className="label">Axis select</div>
        <div className="row">
          {AXES.map((a) => (
            <button key={a} className={a === s.selectedAxis ? 'on' : ''} data-testid={`sel-${a}`}
              onClick={() => dispatch({ type: 'SELECT_AXIS', axis: a })}>{a}</button>
          ))}
        </div>
        <div className="label">Jog increment (mm / deg)</div>
        <div className="row">
          {UMC500.jogIncrements.map((i) => (
            <button key={i} className={i === s.jogIncrement ? 'on' : ''} data-testid={`inc-${i}`}
              onClick={() => dispatch({ type: 'SET_INCREMENT', increment: i })}>{INC_LABEL[i]}<small> {i} mm</small></button>
          ))}
        </div>
        <div className="label">Jog keys</div>
        <div className="grid">
          {AXES.map((a) => (
            <div key={a} className="pair">
              <button data-testid={`jog-${a}-`} onClick={() => dispatch({ type: 'JOG', axis: a, direction: -1 })}>-{a}</button>
              <button data-testid={`jog-${a}+`} onClick={() => dispatch({ type: 'JOG', axis: a, direction: 1 })}>+{a}</button>
            </div>
          ))}
        </div>
        <div className="label">Handle (simulated; scroll or click)</div>
        <div className="row handle"
          onWheel={(e) => dispatch({ type: 'JOG', direction: e.deltaY < 0 ? 1 : -1 })}>
          <button data-testid="handle-" onClick={() => dispatch({ type: 'JOG', direction: -1 })}>⟲ −</button>
          <div className="wheel">{s.selectedAxis}</div>
          <button data-testid="handle+" onClick={() => dispatch({ type: 'JOG', direction: 1 })}>+ ⟳</button>
        </div>
        <Keypad />
        <CoordPanel />
        <MeasureAndCheck />
        <div className="label">Not available in this phase</div>
        <div className="row">
          {DISABLED.map((k) => <button key={k} disabled title="Not implemented / unverified">{k}</button>)}
        </div>
      </div>
      </>}
    </div>
  );
}
