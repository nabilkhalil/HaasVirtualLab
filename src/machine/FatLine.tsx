import { useEffect, useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/**
 * Wide line whose MATERIAL lives for the component's lifetime. (drei <Line> disposes its material whenever the
 * points change, which forces a shader re-link on every state update.) Points changes swap in a new geometry and
 * dispose the old one, so GPU buffers are released and no shader is recompiled.
 */
export function FatLine({ points, color, lineWidth = 1, dashed = false, dashSize = 1, gapSize = 1 }:
  { points: number[][]; color: string; lineWidth?: number; dashed?: boolean; dashSize?: number; gapSize?: number }) {
  const size = useThree((s) => s.size);
  const [line] = useState(() => new Line2(new LineGeometry(), new LineMaterial({ linewidth: lineWidth })));
  const key = points.map((p) => p.join(',')).join(';');
  useLayoutEffect(() => {
    const g = new LineGeometry();
    g.setPositions(points.flatMap((p) => [p[0], p[1], p[2] ?? 0]));
    const old = line.geometry;
    line.geometry = g;
    if (dashed) line.computeLineDistances();
    old.dispose();
  }, [key, dashed]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const m = line.material;
    m.color.set(color); m.linewidth = lineWidth; m.dashSize = dashSize; m.gapSize = gapSize;
    if (m.dashed !== dashed) { m.dashed = dashed; if (dashed) m.defines.USE_DASH = ''; else delete m.defines.USE_DASH; m.needsUpdate = true; }
  }, [color, lineWidth, dashed, dashSize, gapSize, line]);
  useLayoutEffect(() => { line.material.resolution.set(size.width, size.height); }, [size, line]);
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
  return <primitive object={line} />;
}
