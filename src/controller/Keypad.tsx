import type { Key } from '../engine/machine';
import { useMachine } from '../store/machineStore';

/** NGC key labels per S1 (Mill Operator's Manual 96-8210 Rev N). */
const MODES: [Key, string][] = [['HANDLE_JOG', 'HANDLE JOG'], ['ZERO_RETURN', 'ZERO RETURN'], ['ALL', 'ALL'], ['SINGLE', 'SINGLE']];
const FUNC: [Key, string][] = [['TOOL_OFFSET_MEASURE', 'TOOL OFFSET MEASURE'], ['NEXT_TOOL', 'NEXT TOOL'], ['PART_ZERO_SET', 'PART ZERO SET'], ['F1', 'F1'], ['F4', 'F4'], ['ORIGIN', 'ORIGIN']];
const NUM: Key[] = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '.'];

export function Keypad() {
  const { state: s, dispatch } = useMachine();
  const k = (key: Key, label: string = key, cls = '') => (
    <button key={key} className={'k ' + cls} data-testid={`key-${key}`} onClick={() => dispatch({ type: 'KEY', key })}>{label}</button>
  );
  return (
    <div className="keypad" data-testid="keypad">
      <div className="row">{MODES.map(([key, l]) => k(key, l, s.mode === key ? 'fn on' : 'fn'))}</div>
      <div className="row">{FUNC.map(([key, l]) => k(key, l, 'fn'))}</div>
      <div className="kp">
        <div className="arrows">
          {k('PAGE_UP', 'PAGE UP')}{k('UP', '▲')}{k('PAGE_DOWN', 'PAGE DOWN')}
          {k('LEFT', '◀')}{k('DOWN', '▼')}{k('RIGHT', '▶')}
        </div>
        <div className="nums">{NUM.map((n) => k(n))}</div>
        <div className="col">
          {k('CANCEL')}{k('ENTER', 'ENTER', 'enter')}
          {s.prompt && <div className="row">{k('Y', 'Y', 'yn')}{k('N', 'N', 'yn')}</div>}
        </div>
      </div>
    </div>
  );
}
