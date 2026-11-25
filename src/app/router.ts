import { useEffect, useState } from 'react';
/** Hash routing (static hosting / GitHub Pages compatible): #/academy/M05 -> ['academy','M05']. */
const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
export function useRoute(): string[] {
  const [r, setR] = useState(parse);
  useEffect(() => { const f = () => setR(parse()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (path: string) => { window.location.hash = '/' + path; };
