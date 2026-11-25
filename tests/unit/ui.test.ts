import { describe, expect, it } from 'vitest';
import { clampPanel, MAX_PANEL, MIN_PANEL, useUi } from '../../src/store/uiStore';
import { globalShortcut, isTypingTarget, jogForKey, SHORTCUTS, toggleFullscreen, JOG_KEYS } from '../../src/app/shortcuts';
import { VERSION } from '../../src/app/version';
import pkg from '../../package.json';

describe('panel sizing', () => {
  it('clamps to the allowed range and rejects nonsense', () => {
    expect(clampPanel(10)).toBe(MIN_PANEL);
    expect(clampPanel(99)).toBe(MAX_PANEL);
    expect(clampPanel(68.4)).toBe(68);
    expect(clampPanel(Number.NaN)).toBe(68);
    expect(clampPanel(70)).toBe(70);
  });
  it('stores a clamped width and the keyboard-jog preference', () => {
    useUi.getState().setPanel(200);
    expect(useUi.getState().panelPct).toBe(MAX_PANEL);
    useUi.getState().setPanel(-5);
    expect(useUi.getState().panelPct).toBe(MIN_PANEL);
    useUi.getState().setKeysJog(false);
    expect(useUi.getState().keysJog).toBe(false);
    useUi.getState().setKeysJog(true);
  });
});

const ev = (el: unknown) => ({ target: el as EventTarget });
/** The helpers duck-type their target, so plain objects test the guard without a DOM. */
const fake = (tagName: string, editable = false) => ({ tagName, isContentEditable: editable }) as unknown as EventTarget;
describe('keyboard shortcuts', () => {
  it('maps arrows to X/Z and PageUp/PageDown to Y', () => {
    expect(jogForKey('ArrowLeft')).toEqual({ axis: 'X', dir: -1 });
    expect(jogForKey('ArrowRight')).toEqual({ axis: 'X', dir: 1 });
    expect(jogForKey('ArrowUp')).toEqual({ axis: 'Z', dir: 1 });
    expect(jogForKey('ArrowDown')).toEqual({ axis: 'Z', dir: -1 });
    expect(jogForKey('PageUp')).toEqual({ axis: 'Y', dir: 1 });
    expect(jogForKey('PageDown')).toEqual({ axis: 'Y', dir: -1 });
    expect(jogForKey('a')).toBeNull();
    expect(Object.keys(JOG_KEYS)).toHaveLength(6);
  });
  it('never treats form fields or editors as shortcuts', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isTypingTarget(fake(tag)), tag).toBe(true);
      expect(globalShortcut({ key: '?', ...ev(fake(tag)) }), tag).toBeNull();
    }
    expect(isTypingTarget(fake('DIV'))).toBe(false);
    expect(isTypingTarget(fake('DIV', true))).toBe(true);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });
  it('opens help with ? and fullscreen with F, ignoring modifiers', () => {
    const body = fake('BODY');
    expect(globalShortcut({ key: '?', ...ev(body) })).toBe('help');
    expect(globalShortcut({ key: 'f', ...ev(body) })).toBe('fullscreen');
    expect(globalShortcut({ key: 'F', ...ev(body) })).toBe('fullscreen');
    expect(globalShortcut({ key: '?', ctrlKey: true, ...ev(body) })).toBeNull();
    expect(globalShortcut({ key: 'x', ...ev(body) })).toBeNull();
  });
  it('lists every shortcut in the help overlay', () => {
    expect(SHORTCUTS.map((s) => s.id)).toEqual(['help', 'fullscreen', 'escape', 'jogX', 'jogZ', 'jogY', 'panel']);
  });
  it('fullscreen degrades safely when the browser refuses or lacks it', async () => {
    await expect(toggleFullscreen()).resolves.toBe(false);
  });
});

describe('release version', () => {
  it('is injected from package.json and is semver', () => {
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).toBe('1.0.0');
  });
});
