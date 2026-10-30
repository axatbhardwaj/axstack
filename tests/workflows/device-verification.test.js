import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const ui = 'skills/axstack/references/ui-verification.md';
const recipe = 'skills/axstack-verify/SKILL.md';
const fleet = 'skills/axstack/references/fleet-route-schema.md';
const roster = 'skills/axstack/references/role-roster.md';

// Prompt contracts protect device verification decisions, not live compliance.
// Existing browser checks do not cover independent device runs or fleet safety.
function rule(name, path, concepts, equivalent, inversions, ban) {
  test(`device verification: ${name}`, () => {
    const source = read(path).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*]/g, '').replace(/\s+/g, ' ');
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(source, accepts, equivalent, inversions, concepts);
  });
}

rule('Terra first run', ui, [/Android/i, /web\/PWA/i, /run 1/i, /axstack-ui-verifier\b/i, /Terra/i, /high/i],
  'For Android and web/PWA, assign run 1 to axstack-ui-verifier, Terra high.', [[/run 1/i, 'run 2']]);
rule('independent Sonnet second run', ui,
  [/run 2/i, /axstack-ui-verifier-sonnet/i, /independent/i, /same brief/i, /same pinned build/i],
  'Dispatch independent run 2 to axstack-ui-verifier-sonnet with the same brief and same pinned build.',
  [[/independent/i, 'dependent'], [/same pinned build/i, 'latest floating build']]);
rule('blind second run', ui, [/run 2/i, /run 1.*results/i],
  'Never show run 2 the run 1 results.', [[/never/i, 'always']], /never/i);
rule('serial emulator runs', ui, [/run 2/i, /after run 1/i, /shutdown/i],
  'Start run 2 after run 1 finishes shutdown.', [[/after run 1/i, 'alongside run 1']]);
rule('both passes', ui, [/both runs pass/i, /driver/i, /records? pass/i],
  'When both runs pass, the driver records pass.', [[/both runs pass/i, 'either run passes']]);
rule('both failures route debug', ui, [/both runs fail/i, /driver/i, /records? fail/i, /axstack-debug/i],
  'When both runs fail a feature, the driver records fail and routes it to axstack-debug.',
  [[/records? fail/i, 'records pass'], [/axstack-debug/i, 'axstack-explain']]);
rule('bounded disagreement', ui, [/if runs disagree/i, /driver/i, /holds/i, /one Sonnet rerun/i, /feature/i],
  'If runs disagree, the driver holds and requests one Sonnet rerun of that feature.',
  [[/one Sonnet rerun/i, 'unlimited Sonnet reruns'], [/holds/i, 'passes']]);
rule('Sonnet rerun has independent resources and pinned inputs', ui,
  [/Sonnet rerun/i, /(?:fresh|new) delegated session/i, /(?:separate|own) private evidence folder/i,
    /same brief/i, /same pinned build/i],
  'Run the Sonnet rerun in a new delegated session with its own private evidence folder, the same brief and same pinned build.',
  [[/fresh|new/i, 'reused'], [/(?:separate|own) private evidence folder/i, 'shared evidence folder'],
    [/same pinned build/i, 'latest floating build']]);
rule('Sonnet rerun is blind to both earlier results', ui,
  [/Sonnet rerun/i, /run 1/i, /run 2/i, /results/i],
  'Do not show the Sonnet rerun results from run 1 or run 2.',
  [[/never show|do not show/i, 'Show']], /never show|do not show/i);
rule('persistent rerun disagreement', ui,
  [/if (?:the )?rerun still disagrees with run 1/i, /report/i, /flaky\/unverified/i, /all observations/i],
  'If the rerun still disagrees with run 1, report flaky/unverified with all observations.',
  [[/still disagrees/i, 'agrees'], [/flaky\/unverified/i, 'pass']]);
rule('rerun agreement resolves feature with evidence', ui,
  [/if (?:the )?rerun agrees with run 1/i, /agreed result stands/i, /record/i, /initial disagreement/i, /evidence/i],
  'If the rerun agrees with run 1, the agreed result stands while the driver records the initial disagreement in evidence.',
  [[/agrees with run 1/i, 'still disagrees with run 1'], [/agreed result stands/i, 'feature remains unverified']]);
rule('configured verifier roles', ui,
  [/configured UI verifier roles/i, /axstack-ui-verifier(?!-sonnet)\b/i, /axstack-ui-verifier-sonnet/i, /role snapshot/i],
  'The configured UI verifier roles are axstack-ui-verifier and axstack-ui-verifier-sonnet from the role snapshot.',
  [[/axstack-ui-verifier-sonnet/i, 'author']]);
rule('explicit dual run trigger', ui,
  [/apply|use/i, /dual run/i, /Android device verification/i, /explicitly requested PWA\/app feature verification/i,
    /verify-<app> device recipe/i, /user request/i],
  'Use the dual run for Android device verification or explicitly requested PWA/app feature verification via a verify-<app> device recipe or user request.',
  [[/explicitly requested PWA\/app/i, 'all PWA/app']]);
rule('ordinary review and watch remain one pass', ui,
  [/ordinary review and watch/i, /browser checks/i, /one axstack-ui-verifier pass/i, /by default/i],
  'Ordinary review and watch browser checks use one axstack-ui-verifier pass by default.',
  [[/one axstack-ui-verifier pass/i, 'two independent verifier passes'], [/by default/i, 'only on explicit request']]);
rule('missing Apple host', ui, [/iOS/i, /without a capable host/i, /report/i, /unverified/i],
  'For iOS without a capable host, report unverified.', [[/unverified/i, 'pass']]);
rule('route host selection', ui, [/select|choose/i, /host/i, /fleet routing/i, /account.local/i],
  'Choose the host through fleet routing using account-local configuration.', [[/fleet routing/i, 'hardcoded defaults']]);
rule('desktop safety', ui, [/desktop:user/i, /headless browser/i, /windowless emulator/i, /only/i],
  'On a desktop:user host, use only a headless browser and a windowless emulator.', [[/only/i, 'any mode including']]);
rule('unknown desktop status is safe', ui,
  [/desktop:user/i, /missing or unknown/i, /treat/i, /host as a user desktop/i],
  'When desktop:user status is missing or unknown, treat the host as a user desktop.',
  [[/missing or unknown/i, 'explicitly true'], [/host as a user desktop/i, 'host as a worker']]);
rule('no focus or workspace changes', ui, [/focus windows/i, /switch workspaces/i, /user desktop/i],
  'Never focus windows or switch workspaces on a user desktop.', [[/never/i, 'always']], /never/i);
rule('one emulator per host', ui, [/one emulator/i, /per host/i, /at a time/i],
  'Allow one emulator per host at a time.', [[/one emulator/i, 'multiple emulators']]);
rule('declared thermal precheck', ui, [/thermal precheck/i, /before/i, /hosts that declare/i],
  'Run a thermal precheck before starting on hosts that declare one.', [[/before/i, 'after']]);
rule('device discovery', ui, [/device_list/i, /agentDeviceInstalled.*true/i, /before/i, /device_open/i],
  'Call device_list and confirm agentDeviceInstalled: true before device_open.', [[/before/i, 'after']]);
rule('device command boundary', ui, [/device_open/i, /returned.*agent-device/i, /install/i, /launch/i, /drive/i],
  'Use device_open and its returned agent-device command to install, launch and drive the pinned APK.',
  [[/returned/i, 'unrelated']]);
rule('device evidence', ui, [/snapshot/i, /device_screenshot/i, /each.*end state/i, /private evidence/i],
  'Save a snapshot and device_screenshot for each feature end state in private evidence.',
  [[/each.*end state/i, 'the launch screen']]);
rule('web Playwright', ui, [/web\/PWA/i, /Playwright MCP/i, /390.*844/i, /1440.*900/i],
  'For web/PWA, use Playwright MCP at 390x844 and 1440x900.', [[/Playwright MCP/i, 'preview tools']]);
rule('owned shutdown', ui, [/device_close/i, /shutdown.*true/i, /browser_close/i, /after each run/i, /failed/i],
  'After each run, including failed attempts, use device_close with shutdown: true and browser_close for owned sessions.',
  [[/shutdown.*true/i, 'shutdown: false'], [/after each run/i, 'after successful runs only']]);
rule('pinned evidence', ui, [/record/i, /APK SHA-256|build SHA/i, /PWA deploy SHA/i, /before/i, /run 1/i],
  'Before run 1, record APK SHA-256 and PWA deploy SHA in the brief.', [[/before/i, 'after']]);
rule('recipe device section', recipe, [/require/i, /Device section/i, /verify-<app>/i, /device surface/i],
  'For a device surface, require a Device section in generated verify-<app> recipes.', [[/require/i, 'omit']]);
rule('recipe device lifecycle', recipe, [/Device section/i, /must use|shall use/i, /device tools/i, /install/i, /launch/i, /drive/i, /evidence/i, /shutdown/i],
  'The Device section must use device tools to install and launch the pinned build, drive features, capture evidence and shutdown owned devices.',
  [[/must use/i, 'can bypass']]);
rule('recipe dual run reference', recipe, [/Device section/i, /follow/i, /UI verification/i, /dual.run/i],
  'The Device section must follow UI verification for dual-run independence and reconciliation.', [[/follow/i, 'bypass']]);
rule('fleet examples', fleet, [/device/i, /playwright/i, /taskOrders/i, /examples only/i, /account.local/i],
  'In account-local taskOrders, device and playwright are examples only.', [[/examples only/i, 'shipped defaults']]);
rule('fleet capabilities', fleet, [/device:android-emulator/i, /browser:headless/i, /desktop:user/i, /capability/i, /examples only/i],
  'Capability names device:android-emulator, browser:headless and desktop:user are examples only.',
  [[/examples only/i, 'mandatory built-ins']]);
rule('roster single provider absence', roster,
  [/axstack-ui-verifier-sonnet/i, /intentionally absent/i, /both single.provider presets/i, /dual.run.*unverified/i],
  'axstack-ui-verifier-sonnet is intentionally absent in both single-provider presets, leaving dual-run verification unverified.',
  [[/intentionally absent/i, 'enabled'], [/unverified/i, 'passed']]);

test('device guidance keeps private fleet identities out of shipped defaults', () => {
  expect([read(ui), read(fleet)].join('\n')).not.toMatch(/\b(?:iobox|iosatellite|iobook|axat-vps)\b|`io`/i);
  expect(read(recipe)).toContain('../axstack/references/ui-verification.md');
});

for (const preset of ['mixed', 'codex-only', 'claude-only']) {
  test(`independent UI seat follows ${preset} provider policy`, () => {
    const roles = JSON.parse(read(`profiles/presets/${preset}.json`)).roles;
    const index = roles.findIndex(({ id }) => id === 'axstack-ui-verifier');
    const second = roles[index + 1];
    expect(second.id).toBe('axstack-ui-verifier-sonnet');
    expect(second.thinkingOptionId).toBe('high');
    if (preset === 'mixed') {
      expect(second).toMatchObject({ provider: 'claude', modelClass: 'sonnet', modeId: 'bypassPermissions' });
      expect(roles[index]).toMatchObject({ provider: 'codex', modelClass: 'terra', thinkingOptionId: 'high' });
      expect(second.notes).toMatch(/read.only/i);
      expect(second.notes).toMatch(/never edits source/i);
    } else {
      expect(second.provider).toBe(preset === 'codex-only' ? 'codex' : 'claude');
      expect(second.model).toBeNull();
      expect(second.modelClass).toBeUndefined();
      expect(second.notes).toMatch(/intentional.*absence/i);
    }
  });
}
