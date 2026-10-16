import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessState, redeemInvite, completeAccount, completeVerificationStep, submitVerification, demoReview, DEMO_INVITE } from '../dist/access-model.js';
import { renderAccessPage, accessStatusLabel, accessErrorMessage } from '../dist/access-ui.js';

function stages() {
  const list = [createAccessState()];
  list.push(redeemInvite(list.at(-1), DEMO_INVITE, 1));
  list.push(completeAccount(list.at(-1), { alias: 'demo-cedar', role: 'provider' }, 2));
  for (const step of ['identity', 'document', 'selfie']) list.push(completeVerificationStep(list.at(-1), step, { confirmed: true }, 3));
  list.push(submitVerification(list.at(-1), 4));
  const pending = list.at(-1);
  for (const outcome of ['verified', 'action_required', 'rejected']) list.push(demoReview(pending, outcome, 5));
  return list;
}

test('every access screen renders both languages without real-data collection controls', () => {
  for (const state of stages()) for (const language of ['ru', 'en']) {
    const html = renderAccessPage(state, { language });
    assert.ok(html.includes('data-no-i18n'));
    assert.ok(html.includes('access-demo-notice'));
    assert.ok(!/type="(?:file|email|password)"|capture=|<video|<canvas|<img|fetch\(/i.test(html));
    assert.ok(!html.includes('>НТ<'));
    assert.ok(!html.includes('undefined'));
    if (language === 'en') assert.ok(!/[А-Яа-яЁё]/.test(html));
  }
});

test('form and action contracts follow the current lifecycle step', () => {
  const states = stages();
  const render = index => renderAccessPage(states[index], { language: 'en' });
  assert.ok(render(0).includes('id="access-invite-form"'));
  assert.ok(render(0).includes('name="invite"'));
  assert.ok(render(0).includes('HANDSHAKE-DEMO'));
  assert.ok(render(1).includes('id="access-account-form"'));
  assert.ok(render(1).includes('<select id="access-alias" name="alias"'));
  assert.ok(render(1).includes('name="role" value="provider"'));
  for (const [index, step] of [[2, 'identity'], [3, 'document'], [4, 'selfie']]) {
    assert.ok(render(index).includes(`id="access-verification-form" class="access-form" data-step="${step}"`));
    assert.ok(render(index).includes('name="confirmed" required'));
  }
  assert.ok(render(5).includes('data-action="access-submit-review"'));
  assert.ok(render(6).includes('data-action="access-demo-review" data-result="verified"'));
  assert.ok(render(7).includes('data-action="access-continue"'));
  assert.ok(render(8).includes('data-step="document"'));
  assert.ok(render(9).includes('data-action="access-restart-verification"'));
});

test('unknown stored identity and raw errors cannot enter rendered markup', () => {
  const html = renderAccessPage({ version: 1, profile: { alias: '<script>alert(1)</script>', email: 'PRIVATE_EMAIL' } }, { language: 'en', error: new Error('<script>alert(1)</script>') });
  assert.ok(!html.includes('PRIVATE_EMAIL'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Could not complete this demo step.'));
  assert.equal(accessErrorMessage({ code: 'invite_required' }, 'en'), 'Accept a valid demo invitation first.');
  assert.equal(accessStatusLabel(createAccessState(), 'en'), 'Guest');
  assert.equal(accessStatusLabel(stages()[7], 'en'), 'Demo verification complete');
});

test('invalid invitation statuses have localized accessible feedback', () => {
  for (const code of ['bad', 'HANDSHAKE-EXPIRED', 'HANDSHAKE-USED']) {
    const html = renderAccessPage(redeemInvite(createAccessState(), code), { language: 'en' });
    assert.ok(html.includes('aria-invalid="true"'));
    assert.ok(html.includes('id="access-invite-status"'));
    assert.ok(html.includes('role="alert"'));
    assert.ok(!/[А-Яа-яЁё]/.test(html));
  }
});
