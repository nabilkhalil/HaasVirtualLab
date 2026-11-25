import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import en from './en.json';
import ms from './ms.json';

/** UI language. Translations live in separate files (en.json, ms.json); missing keys fall back to English. */
export type Lang = 'en' | 'ms';
const DICT: Record<Lang, Record<string, string | string[]>> = { en, ms };
export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>()(persist((set) => ({ lang: 'en', setLang: (lang) => set({ lang }) }), { name: 'hvl-lang' }));
export function translate(lang: Lang, key: string, vars: Record<string, string | number> = {}, fallback?: string): string {
  const v = DICT[lang][key] ?? DICT.en[key] ?? fallback ?? key;
  return (Array.isArray(v) ? v.join(' ') : v).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
export function useT() {
  const lang = useLang((s) => s.lang);
  const t = (key: string, vars?: Record<string, string | number>, fallback?: string) => translate(lang, key, vars, fallback);
  /** Array-valued entries (e.g. module outcomes) with an English fallback array. */
  t.list = (key: string, fallback: string[]) => { const v = DICT[lang][key]; return Array.isArray(v) ? v : fallback; };
  t.lang = lang;
  return t;
}
export const missingKeys = (lang: Lang) => Object.keys(en).filter((k) => !(k in DICT[lang]));
