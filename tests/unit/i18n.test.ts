import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import ms from '../../src/i18n/ms.json';
import { missingKeys, translate } from '../../src/i18n';
import { MODULES } from '../../src/academy/modules';

const vars = (s: unknown) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : []);
describe('translations', () => {
  it('Bahasa Melayu covers every English UI key with the same placeholders', () => {
    expect(missingKeys('ms')).toEqual([]);
    for (const k of Object.keys(en)) expect(vars((ms as Record<string, unknown>)[k]), k).toEqual(vars((en as Record<string, unknown>)[k]));
  });
  it('every module has a Malay title; available modules have Malay outcomes and theory', () => {
    const m = ms as Record<string, unknown>;
    for (const x of MODULES) {
      expect(typeof m[`mod.${x.id}.title`], x.id).toBe('string');
      if (x.available) {
        expect((m[`mod.${x.id}.outcomes`] as string[]).length, x.id).toBe(x.outcomes.length);
        expect(String(m[`mod.${x.id}.theory`]).length, x.id).toBeGreaterThan(100);
      }
    }
  });
  it('interpolation and fallback', () => {
    expect(translate('ms', 'home.modulesComplete', { done: 2, total: 9 })).toBe('2 daripada 9 modul tersedia telah selesai');
    expect(translate('ms', 'no.such.key', {}, 'Fallback')).toBe('Fallback');
    expect(translate('en', 'nav.academy')).toBe('Academy');
  });
});
