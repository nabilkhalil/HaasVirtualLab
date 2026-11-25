import { test, expect } from '@playwright/test';

test('jog, limit, E-stop and reset', async ({ page }) => {
  await page.goto('/#/simulator');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('no-webgl')).toHaveCount(0);
  await page.getByTestId('inc-1').click();
  await page.getByTestId('jog-X-').click();
  await expect(page.getByTestId('pos-X')).toHaveText('-1.000');
  await page.getByTestId('jog-Z+').click();
  await expect(page.getByTestId('message')).toContainText('Travel limit');
  await expect(page.getByTestId('why')).toContainText('travel limit');
  await page.getByTestId('estop').click();
  await expect(page.getByTestId('status')).toHaveText('E-STOP');
  await page.getByTestId('jog-X-').click();
  await expect(page.getByTestId('pos-X')).toHaveText('-1.000');
  await page.getByTestId('estop').click();
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('status')).toHaveText('READY');
  await page.getByTestId('sel-C').click();
  await page.getByTestId('handle-').click();
  await expect(page.getByTestId('pos-C')).toHaveText('359.000°');
  await expect(page.getByRole('button', { name: 'MDI' })).toBeDisabled();
});

test('NGC offset keys, Setting 142 prompt and tool change', async ({ page }) => {
  await page.goto('/#/simulator');
  const key = (k: string) => page.getByTestId(`key-${k}`).click();
  await key('OFFSET');
  await page.getByTestId('off-1-hWear').click();
  for (const k of ['.', '0', '2', 'F1']) await key(k);
  await expect(page.getByTestId('off-1-hWear')).toHaveText('0.020');
  for (const k of ['.', '0', '1', 'ENTER']) await key(k);
  await expect(page.getByTestId('off-1-hWear')).toHaveText('0.030');
  await page.getByTestId('off-1-hGeom').click();
  for (const k of ['-', '2', '5', '0', 'F1']) await key(k);
  await expect(page.getByTestId('prompt')).toContainText('Setting 142');
  await key('N');
  await expect(page.getByTestId('off-1-hGeom')).toHaveText('0.000');
  await page.getByTestId('tab-SETUP').click();
  await page.getByTestId('load-T3').click();
  await page.getByTestId('tab-CONTROL').click();
  await expect(page.getByTestId('active-tool')).toHaveText('3');
  await key('NEXT_TOOL');
  await expect(page.getByTestId('active-tool')).toHaveText('4');
  await expect(page.getByTestId('chk-stored')).toHaveText('0.000');
  await expect(page.getByTestId('paper')).toHaveText('NOT OVER PART');
});

test('guided highlight and scored assessment', async ({ page }) => {
  await page.goto('/#/simulator');
  await page.getByTestId('lesson-select').selectOption('A');
  await page.getByTestId('lesson-start').click();
  await expect(page.getByTestId('guide')).toContainText('increment');
  await expect(page.getByTestId('inc-1')).toHaveCSS('outline-style', 'solid');
  await page.getByTestId('lesson-exit').click();
  await page.getByTestId('mode-assessment').click();
  await page.getByTestId('lesson-select').selectOption('D');
  await page.getByTestId('lesson-start').click();
  await expect(page.getByTestId('len-err')).toHaveCount(0); // truth hidden in assessment
  await page.getByTestId('lesson-q-tip').locator('input').fill('1.2');
  await page.getByTestId('lesson-q-dir').getByRole('button', { name: 'below' }).click();
  await page.getByTestId('lesson-submit').click();
  await expect(page.getByTestId('lesson-result')).toContainText('100 / 100');
});

test('work offsets: F4 tab, PART ZERO SET, G55 switching, setup panel', async ({ page }) => {
  await page.goto('/#/simulator');
  const key = (k: string) => page.getByTestId(`key-${k}`).click();
  await page.getByTestId('inc-1').click();
  await page.getByTestId('jog-X-').click();
  await key('OFFSET'); await key('F4');
  await expect(page.getByTestId('work-screen')).toBeVisible();
  await key('PART_ZERO_SET');
  await expect(page.getByTestId('work-G54-X')).toHaveText('-1.000');
  for (const k of ['DOWN', '-', '5', 'F1']) await key(k);
  await expect(page.getByTestId('work-G55-Y')).toHaveText('-5.000');
  await page.getByTestId('wcs-G55').click();
  await expect(page.getByTestId('active-wcs')).toHaveText('G55');
  await expect(page.getByTestId('c-work-Y')).toHaveText('5.000');
  await expect(page.getByTestId('c-mach-X')).toHaveText('-1.000');
  await page.getByTestId('tab-SETUP').click();
  await page.getByTestId('clamp-A').click();
  await expect(page.getByTestId('setup-issues')).toContainText('unclamped');
  await page.getByTestId('lesson-select').selectOption('W-C');
  await page.getByTestId('lesson-start').click();
  await expect(page.getByTestId('guide')).toContainText('Load T6');
  await expect(page.getByTestId('tab-SETUP')).toHaveCSS('outline-style', 'solid');
});

test('five-axis: simulated MDI rotation, DWO rules, HANDLE JOG cancel, guided lesson', async ({ page }) => {
  await page.goto('/#/simulator');
  await page.getByTestId('tab-5AXIS').click();
  await page.getByTestId('rot-B').fill('30');
  await page.getByTestId('rot-B').blur();
  await page.getByTestId('mdi-rotate').click();
  await expect(page.getByTestId('five-message')).toContainText('B30');
  await page.getByTestId('mdi-g254').click();
  await expect(page.getByTestId('five-message')).toContainText('G254 DWO active');
  await page.getByTestId('mdi-rotate').click();
  await expect(page.getByTestId('five-message')).toContainText('G255 before ANY rotary');
  await expect(page.getByTestId('five-report')).toBeVisible();
  await page.getByTestId('tab-CONTROL').click();
  await expect(page.getByTestId('mode')).toContainText('G254');
  await page.getByTestId('key-HANDLE_JOG').click();
  await expect(page.getByTestId('message')).toContainText('G254 cancelled by HANDLE JOG');
  await expect(page.getByTestId('pos-B')).toHaveText('30.000°');
  await page.getByTestId('lesson-start').click();
  await expect(page.getByTestId('guide')).toContainText('Select the B axis');
  await expect(page.getByTestId('sel-B')).toHaveCSS('outline-style', 'solid');
});

test('academy: home, module page, guided step help, quiz, progress persists, resume', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await page.getByTestId('tile-academy').click();
  await page.getByTestId('mod-M07').click();
  await expect(page.getByTestId('module-unavailable')).toContainText('Phase 4');
  await page.goto('/#/academy/M02');
  await page.getByTestId('start-guided-C').click();
  await expect(page.getByTestId('guide')).toContainText('Press OFFSET');
  await expect(page.getByTestId('guide-why')).toContainText('OFFSET display');
  await expect(page.getByTestId('guide-expect')).toBeVisible();
  await expect(page.getByTestId('key-OFFSET')).toHaveCSS('outline-style', 'solid');
  await page.getByTestId('key-F1').click();
  await expect(page.getByTestId('guide')).toContainText('Press OFFSET'); // wrong key: no advance
  await page.getByTestId('key-OFFSET').click();
  await expect(page.getByTestId('guide')).toContainText('tool 2');
  await page.waitForTimeout(600);
  await page.getByTestId('lesson-module').click();
  const answers = [1, 0, 0, 0];
  for (const [i, a] of answers.entries()) await page.getByTestId(`quiz-${i}-${a}`).check();
  await page.getByTestId('quiz-submit').click();
  await expect(page.getByTestId('quiz-result')).toContainText('4 / 4');
  await expect(page.getByTestId('module-status')).toHaveText('In progress');
  await page.reload();
  await expect(page.getByTestId('module-status')).toHaveText('In progress');
  await page.getByTestId('nav-home').click();
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('guide')).toContainText('tool 2');
});

test('assessment engine, dashboard, CSV/JSON export and restore', async ({ page }) => {
  await page.goto('/#/assessment');
  await page.getByTestId('as-indep-M04').click();
  await expect(page.getByTestId('lesson-panel')).toContainText('Prepare and clamp');
  await page.getByTestId('tab-SETUP').click();
  await page.getByTestId('clamp-A').click(); // clamp without parallels/alignment: incomplete setup
  await page.getByTestId('lesson-submit').click();
  await expect(page.getByTestId('result-metrics')).toContainText('variant #');
  await expect(page.getByTestId('result-feedback')).toBeVisible();
  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId('dash-history')).toContainText('W-0');
  await expect(page.getByTestId('dash-recommend')).toContainText('M04');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
  const csvText = await (await import('fs')).promises.readFile((await csv.path())!, 'utf8');
  expect(csvText.split('\r\n')[0]).toContain('date,module,lesson,mode,score');
  expect(csvText).toContain('W-0');
  const [js] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
  const backup = await (await import('fs')).promises.readFile((await js.path())!, 'utf8');
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(page.getByTestId('dash-attempts')).toHaveText('0');
  await page.getByTestId('restore-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByTestId('dash-msg')).toContainText('Restored 1 attempts');
  await expect(page.getByTestId('dash-attempts')).toHaveText('1');
  await page.getByTestId('restore-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"x"}') });
  await expect(page.getByTestId('dash-msg')).toContainText('Restore failed');
});

test('Bahasa Melayu: switch, translated academy, persisted after reload', async ({ page }) => {
  await page.goto('/#/academy/M05');
  await page.getByTestId('lang').selectOption('ms');
  await expect(page.getByTestId('nav-academy')).toHaveText('Akademi');
  await expect(page.getByTestId('module-theory')).toContainText('Ofset panjang alat Haas');
  await page.reload();
  await expect(page.getByTestId('nav-dashboard')).toHaveText('Papan Pemuka');
  await page.getByTestId('nav-simulator').click();
  await expect(page.getByTestId('tab-CONTROL')).toHaveText('PENGAWAL');
  await expect(page.getByTestId('key-OFFSET')).toHaveText('OFFSET'); // Haas key labels stay English
  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId('dashboard')).toContainText('Papan Pemuka Pembelajaran');
  const [msCsv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
  const msText = await (await import('fs')).promises.readFile((await msCsv.path())!, 'utf8');
  expect(msText.split('\r\n')[0].startsWith('tarikh,modul,latihan,mod,markah')).toBe(true);
  await page.getByTestId('nav-academy').click();
  await page.getByTestId('lang').selectOption('en');
  await page.getByTestId('nav-simulator').click();
  await expect(page.getByTestId('tab-CONTROL')).toHaveText('CONTROLLER');
});

test('performance guards: no shader re-link on jog/typing, WebGL released on navigation', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => { if (/WebGL|context/i.test(m.text())) warnings.push(m.text()); });
  await page.goto('/#/simulator');
  await page.waitForFunction(() => !!(window as unknown as { __hvlGl?: unknown }).__hvlGl);
  await page.waitForTimeout(800);
  await page.evaluate(() => { const g = (window as any).__hvlGl.getContext(); (window as any).__links = 0; const o = g.linkProgram.bind(g); g.linkProgram = (x: unknown) => { (window as any).__links++; return o(x); }; });
  await page.getByTestId('inc-1').click();
  for (let i = 0; i < 6; i++) await page.getByTestId('jog-X-').click();
  await page.getByTestId('key-OFFSET').click();
  for (const k of ['1', '2', '3']) await page.getByTestId(`key-${k}`).click();
  expect(await page.evaluate(() => (window as any).__links)).toBe(0);
  for (let i = 0; i < 6; i++) { await page.getByTestId('nav-home').click(); await page.getByTestId('nav-simulator').click(); await expect(page.locator('canvas')).toBeVisible(); }
  expect(warnings.filter((w) => /too many active webgl contexts/i.test(w))).toEqual([]);
});

test('v1.0: case studies, reference, guide, settings, version and shortcut overlay', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-version')).toHaveText('v1.0.0');
  // Case studies list -> detail -> launch the linked lesson in the shared simulator.
  await page.getByTestId('tile-cases').click();
  await expect(page.getByTestId('cases')).toBeVisible();
  await expect(page.locator('[data-testid^="case-tile-CS-"]')).toHaveCount(6);
  await page.getByTestId('case-tile-CS-4').click();
  await expect(page.getByTestId('case-CS-4')).toContainText('3+2 bracket');
  await expect(page.getByTestId('case-level')).toBeVisible();
  await expect(page.getByTestId('case-objectives').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('case-checks').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('case-pitfalls').locator('li').first()).toBeVisible();
  await page.locator('[data-testid^="case-step-lesson-"]').first().click();
  await expect(page.getByTestId('lesson-panel')).toContainText('Guided');
  await expect(page.getByTestId('guide')).toBeVisible();
  // Reference library tables.
  await page.getByTestId('nav-reference').click();
  await expect(page.getByTestId('ref-sources').locator('tbody tr')).toHaveCount(3);
  await expect(page.getByTestId('ref-keys').locator('tbody tr')).not.toHaveCount(0);
  await expect(page.getByTestId('ref-unverified').locator('li')).not.toHaveCount(0);
  await expect(page.getByTestId('ref-codes')).toContainText('G254');
  // Guide and settings.
  await page.getByTestId('nav-guide').click();
  await expect(page.getByTestId('guide-shortcuts').locator('tbody tr')).toHaveCount(7);
  await expect(page.getByTestId('guide-version')).toContainText('1.0.0');
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('settings-version')).toContainText('1.0.0');
  await page.getByTestId('settings-panel').fill('56');
  await expect(page.getByTestId('settings-panel-value')).toHaveText('56%');
  await page.getByTestId('settings-keys').uncheck();
  await page.reload();
  await expect(page.getByTestId('settings-panel-value')).toHaveText('56%');
  await expect(page.getByTestId('settings-keys')).not.toBeChecked();
  await page.getByTestId('settings-keys').check();
  // Shortcut overlay: ? opens, Escape closes; F must not fire while typing.
  await page.getByTestId('nav-home').click();
  await page.keyboard.press('?');
  await expect(page.getByTestId('help-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('help-overlay')).toHaveCount(0);
  await page.getByTestId('help-open').click();
  await expect(page.getByTestId('help-overlay')).toContainText('PageUp');
  await page.getByTestId('help-close').click();
  await expect(page.getByTestId('help-overlay')).toHaveCount(0);
});

test('v1.0: keyboard jog, resizable panel and clean unmount of the 3D scene', async ({ page }) => {
  // drei's <Html> labels are portalled into a React-owned overlay; an unmount bug here used to throw
  // "removeChild" on every route change away from the simulator, so keep watching for page errors.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/simulator');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByTestId('inc-1').click();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('pos-X')).toHaveText('-1.000');
  // Y travel is negative-only on the UMC-500 profile (0 to −406), so PageDown is the usable direction.
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('pos-Y')).toHaveText('-1.000');
  // Z rests at the top of its travel (0.000), so only the downward direction moves.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('pos-Z')).toHaveText('-1.000');
  // Typing must not jog.
  await page.getByTestId('lesson-select').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('pos-X')).toHaveText('-1.000');
  // The divider resizes from the keyboard and keeps the machine visible.
  const split = page.getByTestId('split');
  await expect(split).toHaveAttribute('aria-valuenow', '68');
  await split.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(split).toHaveAttribute('aria-valuenow', '64');
  await expect(page.locator('canvas')).toBeVisible();
  const left = await page.locator('main.sim > .left').evaluate((el) => el.getBoundingClientRect().width);
  const total = await page.locator('main.sim').evaluate((el) => el.getBoundingClientRect().width);
  expect(left / total).toBeCloseTo(0.64, 1);
  // Leaving the simulator must not throw while the scene tears down.
  await page.getByTestId('nav-home').click();
  await expect(page.getByTestId('home')).toBeVisible();
  await page.getByTestId('nav-simulator').click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
