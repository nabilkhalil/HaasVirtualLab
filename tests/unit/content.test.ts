import { describe, expect, it } from 'vitest';
import { CASES, caseById } from '../../src/content/cases';
import { CODE_ROWS, GLOSSARY, INCREMENT_ROWS, KEY_ROWS, SOURCES, UNVERIFIED } from '../../src/content/reference';
import { MODULES } from '../../src/academy/modules';
import { lessonById } from '../../src/lessons/toolLessons';
import '../../src/lessons/workLessons';
import '../../src/lessons/fiveLessons';
import en from '../../src/i18n/en.json';
import ms from '../../src/i18n/ms.json';

const dict = { en, ms } as Record<'en' | 'ms', Record<string, unknown>>;

describe('case studies', () => {
  it('has six uniquely identified studies with plausible metadata', () => {
    expect(CASES).toHaveLength(6);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    for (const c of CASES) {
      expect(c.minutes, c.id).toBeGreaterThan(10);
      expect(c.scenario.length, c.id).toBeGreaterThan(60);
      expect(c.objectives.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.checks.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.pitfalls.length, c.id).toBeGreaterThanOrEqual(2);
      expect(caseById(c.id), c.id).toBe(c);
    }
    expect(caseById('CS-9')).toBeUndefined();
  });
  it('only references lessons and available modules that exist', () => {
    for (const c of CASES) {
      for (const s of c.steps) if (s.lesson) expect(lessonById(s.lesson), `${c.id} step lesson ${s.lesson}`).toBeDefined();
      for (const m of [...c.modules, ...c.steps.map((s) => s.module).filter((x): x is string => !!x)]) {
        const mod = MODULES.find((x) => x.id === m);
        expect(mod, `${c.id} module ${m}`).toBeDefined();
        expect(mod!.available, `${c.id} uses unavailable module ${m}`).toBe(true);
      }
    }
  });
  it('cites only registered sources', () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const c of CASES) for (const s of c.sources) expect(ids.has(s), `${c.id} source ${s}`).toBe(true);
  });
  it('is translated into Bahasa Melayu (title, scenario, objectives)', () => {
    for (const c of CASES) {
      for (const lang of ['en', 'ms'] as const) {
        const t = dict[lang][`case.${c.id}.title`];
        const sc = dict[lang][`case.${c.id}.scenario`];
        const ob = dict[lang][`case.${c.id}.objectives`];
        expect(typeof t, `${lang} ${c.id} title`).toBe('string');
        expect(String(sc).length, `${lang} ${c.id} scenario`).toBeGreaterThan(40);
        expect(Array.isArray(ob) && ob.length, `${lang} ${c.id} objectives`).toBeGreaterThanOrEqual(3);
      }
      expect(ms[`case.${c.id}.title` as keyof typeof ms]).not.toBe(en[`case.${c.id}.title` as keyof typeof en]);
    }
  });
});

describe('reference library', () => {
  it('registers the three manual sources with documents', () => {
    expect(SOURCES.map((s) => s.id)).toEqual(['S1', 'S2', 'S3']);
    for (const s of SOURCES) { expect(s.doc.length).toBeGreaterThan(5); expect(s.used.length).toBeGreaterThan(10); }
  });
  it('tables are populated and every row names a known source', () => {
    for (const rows of [KEY_ROWS, INCREMENT_ROWS, CODE_ROWS]) {
      expect(rows.length).toBeGreaterThan(3);
      for (const r of rows) {
        expect(r.name.length && r.value.length, r.name).toBeTruthy();
        expect(['S1', 'S2', 'S3', 'sim']).toContain(r.source);
      }
    }
    expect(UNVERIFIED.length).toBeGreaterThanOrEqual(3);
    expect(new Set(GLOSSARY.map((g) => g.term)).size).toBe(GLOSSARY.length);
  });
  it('lists only program commands the engine implements (no invented G-codes)', () => {
    const supported = new Set(['G00', 'G254', 'G255', 'G234', 'G43']);
    for (const r of CODE_ROWS) {
      const code = r.name.match(/G\d+/)?.[0];
      expect(code, r.name).toBeTruthy();
      expect(supported.has(code!), `${code} is not implemented by the engine`).toBe(true);
    }
  });
  it('machine data matches the configured UMC-500 profile wording', () => {
    const travel = INCREMENT_ROWS.find((r) => r.name === 'Machine travel')!;
    expect(travel.value).toContain('610');
    expect(travel.value).toContain('406');
    expect(INCREMENT_ROWS.find((r) => r.name === 'B axis')!.value).toContain('−35');
  });
});
