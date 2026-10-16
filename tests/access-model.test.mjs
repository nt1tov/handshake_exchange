import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccessState, loadAccessState, migrateAccessState, redeemInvite, completeAccount,
  completeVerificationStep, submitVerification, demoReview, restartVerification,
  accessSummary, canTrade, DEMO_INVITE, DEMO_ALIASES,
} from '../dist/access-model.js';

const now = 1000;
function profile(role = 'client') {
  return completeAccount(redeemInvite(createAccessState(), DEMO_INVITE, now), { alias: DEMO_ALIASES[0], role }, now + 1);
}
function samples(state = profile()) {
  for (const step of ['identity', 'document', 'selfie']) state = completeVerificationStep(state, step, { confirmed: true }, now + 2);
  return state;
}
function reviewing(state = samples()) { return submitVerification(state, now + 3); }
function frozen(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') frozen(child);
  return Object.freeze(value);
}

test('both roles require an invitation, a profile and all sample checks before demo trading', () => {
  for (const role of ['client', 'provider']) {
    const empty = createAccessState();
    assert.equal(accessSummary(empty).step, 'invite');
    assert.equal(canTrade(empty), false);
    const accepted = redeemInvite(empty, ' handshake-demo ', now);
    assert.equal(accessSummary(accepted).step, 'account');
    assert.equal(canTrade(accepted), false);
    const registered = completeAccount(accepted, { alias: DEMO_ALIASES[1], role }, now + 1);
    assert.equal(accessSummary(registered).registered, true);
    assert.equal(accessSummary(registered).step, 'verification');
    assert.equal(canTrade(registered), false);
    const ready = samples(registered);
    assert.equal(ready.verification.step, 'review');
    assert.equal(canTrade(ready), false);
    const pending = reviewing(ready);
    assert.equal(canTrade(pending), false);
    const verified = demoReview(pending, 'verified', now + 4);
    assert.equal(canTrade(verified), true);
    assert.equal(accessSummary(verified).step, 'ready');
    assert.equal(accessSummary(verified).role, role);
  }
});

test('invalid, expired and used demo invitations never grant registration', () => {
  for (const [code, status] of [['random@example.com', 'invalid'], ['HANDSHAKE-EXPIRED', 'expired'], ['HANDSHAKE-USED', 'used']]) {
    const state = redeemInvite(createAccessState(), code, now);
    assert.equal(state.invite.status, status);
    assert.equal(state.invite.redeemedAt, null);
    assert.equal(accessSummary(state).registered, false);
    assert.throws(() => completeAccount(state, { alias: DEMO_ALIASES[0], role: 'client' }, now), { code: 'invite_required' });
    assert.ok(!JSON.stringify(state).includes(code));
    assert.equal(redeemInvite(state, DEMO_INVITE, now).invite.status, 'valid');
  }
  const accepted = frozen(redeemInvite(createAccessState(), DEMO_INVITE, now));
  assert.throws(() => redeemInvite(accepted, DEMO_INVITE, now + 1), { code: 'invite_already_redeemed' });
  assert.equal(accepted.invite.status, 'valid');
});

test('sample checks are ordered, explicit and cannot bypass review', () => {
  const state = frozen(profile());
  assert.throws(() => completeVerificationStep(state, 'document', { confirmed: true }), { code: 'step_out_of_order' });
  for (const confirmed of [undefined, false, 'true', 1]) assert.throws(() => completeVerificationStep(state, 'identity', { confirmed }), { code: 'sample_confirmation_required' });
  assert.throws(() => submitVerification(state), { code: 'samples_incomplete' });
  assert.throws(() => demoReview(state, 'verified'), { code: 'review_not_pending' });
  const pending = frozen(reviewing());
  assert.throws(() => completeVerificationStep(pending, 'identity', { confirmed: true }), { code: 'verification_locked' });
  assert.throws(() => demoReview(pending, 'unknown'), { code: 'invalid_review_result' });
  assert.throws(() => submitVerification(pending), { code: 'samples_incomplete' });
});

test('clarification reopens document and selfie checks and requires a fresh review', () => {
  const state = demoReview(reviewing(), 'action_required', now + 4);
  assert.equal(state.verification.status, 'action_required');
  assert.equal(state.verification.step, 'document');
  assert.deepEqual(state.verification.checks, { identity: true, document: false, selfie: false });
  assert.equal(canTrade(state), false);
  const document = completeVerificationStep(state, 'document', { confirmed: true }, now + 5);
  assert.equal(loadAccessState(document).verification.step, 'selfie');
  assert.throws(() => submitVerification(document, now + 6), { code: 'samples_incomplete' });
  const selfie = completeVerificationStep(document, 'selfie', { confirmed: true }, now + 6);
  const pending = submitVerification(selfie, now + 7);
  assert.equal(pending.verification.attempts, 2);
  assert.equal(pending.verification.reviewedAt, null);
  assert.equal(canTrade(demoReview(pending, 'verified', now + 8)), true);
});

test('rejection blocks trading and an explicit restart keeps the invited profile', () => {
  const rejected = demoReview(reviewing(samples(profile('provider'))), 'rejected', now + 4);
  assert.equal(canTrade(rejected), false);
  const restarted = restartVerification(rejected);
  assert.equal(restarted.verification.status, 'not_started');
  assert.equal(restarted.verification.attempts, 1);
  assert.deepEqual(restarted.verification.checks, { identity: false, document: false, selfie: false });
  assert.deepEqual(restarted.profile, rejected.profile);
  assert.deepEqual(restarted.invite, rejected.invite);
  assert.throws(() => restartVerification(profile()), { code: 'restart_not_allowed' });
  assert.throws(() => restartVerification(demoReview(reviewing(), 'verified', now + 4)), { code: 'restart_not_allowed' });
});

test('all transitions return independent objects and retain only preset demo data', () => {
  const original = frozen(createAccessState());
  const accepted = redeemInvite(original, DEMO_INVITE, now);
  assert.equal(original.invite.status, 'required');
  const registered = completeAccount(frozen(accepted), { alias: DEMO_ALIASES[2], role: 'client', email: 'PRIVATE_EMAIL', passport: 'PRIVATE_DOCUMENT' }, now + 1);
  const identity = completeVerificationStep(frozen(registered), 'identity', { confirmed: true, selfie: 'PRIVATE_PHOTO', name: 'PRIVATE_NAME' }, now + 2);
  assert.equal(registered.verification.checks.identity, false);
  assert.ok(!JSON.stringify(identity).includes('PRIVATE_'));
  const restored = loadAccessState({ ...identity, email: 'PRIVATE_EMAIL', token: 'PRIVATE_TOKEN', profile: { ...identity.profile, email: 'PRIVATE_EMAIL' }, verification: { ...identity.verification, documents: ['PRIVATE_DOCUMENT'] } });
  assert.ok(!JSON.stringify(restored).includes('PRIVATE_'));
  assert.throws(() => completeAccount(accepted, { alias: 'real@example.com', role: 'client' }, now + 1), { code: 'alias_required' });
  assert.throws(() => completeAccount(accepted, { alias: 'Jane Doe', role: 'client' }, now + 1), { code: 'alias_required' });
});

test('loading malformed or incomplete stored access never upgrades registration or verification', () => {
  for (const raw of [null, undefined, '', '{broken', [], { version: 9 }, { version: 1, verification: { status: 'verified' } }]) {
    assert.deepEqual(loadAccessState(raw), createAccessState());
  }
  const verified = demoReview(reviewing(), 'verified', now + 4);
  assert.deepEqual(loadAccessState(JSON.stringify(verified)), verified);
  for (const mutate of [
    state => { state.invite.status = 'invalid'; },
    state => { state.profile.role = 'admin'; },
    state => { state.profile.alias = 'attacker<script>'; },
    state => { state.verification.checks.document = false; },
    state => { state.verification.reviewedAt = null; },
    state => { state.verification.submittedAt = null; },
    state => { state.verification.attempts = 0; },
  ]) {
    const changed = structuredClone(verified);
    mutate(changed);
    assert.equal(canTrade(changed), false);
  }
  assert.deepEqual(migrateAccessState(verified), verified);
});

test('invalid times and unsupported roles fail without changing the state', () => {
  for (const invalid of [-1, NaN, Infinity, '1000', 1.5]) assert.throws(() => redeemInvite(createAccessState(), DEMO_INVITE, invalid), { code: 'invalid_time' });
  const accepted = frozen(redeemInvite(createAccessState(), DEMO_INVITE, now));
  assert.throws(() => completeAccount(accepted, { alias: DEMO_ALIASES[0], role: 'admin' }, now + 1), { code: 'role_required' });
  assert.throws(() => completeAccount(accepted, { alias: DEMO_ALIASES[0], role: 'client' }, now - 1), { code: 'invalid_time' });
  const pending = frozen(reviewing());
  assert.throws(() => demoReview(pending, 'verified', now), { code: 'invalid_time' });
  assert.equal(pending.verification.status, 'in_review');
});
