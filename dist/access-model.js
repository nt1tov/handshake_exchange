// Browser-local product walkthrough. This is neither authentication nor KYC.
export const ACCESS_STORAGE_KEY = 'handshake-access-v1';
export const DEMO_INVITE = 'HANDSHAKE-DEMO';
export const DEMO_ALIASES = ['demo-cedar', 'demo-atlas', 'demo-orbit'];
export const ACCESS_ROLES = ['client', 'provider'];
const inviteStatuses = ['required', 'valid', 'invalid', 'expired', 'used'];
const verificationStatuses = ['not_started', 'in_progress', 'in_review', 'verified', 'action_required', 'rejected'];
const checkSteps = ['identity', 'document', 'selfie'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const timestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
const allChecked = checks => checkSteps.every(step => checks[step] === true);
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const time = value => timestamp(value) ? value : fail('invalid_time');
const blankVerification = () => ({ status: 'not_started', step: 'identity', checks: { identity: false, document: false, selfie: false }, attempts: 0, submittedAt: null, reviewedAt: null });

export function createAccessState() {
  return { version: 1, invite: { status: 'required', redeemedAt: null }, profile: null, verification: blankVerification() };
}

// Keep only fixed demo choices and lifecycle metadata; never retain arbitrary PII.
export function migrateAccessState(raw) {
  const result = createAccessState();
  if (!object(raw) || raw.version !== 1) return result;
  if (object(raw.invite) && inviteStatuses.includes(raw.invite.status)) {
    if (raw.invite.status === 'valid' && timestamp(raw.invite.redeemedAt)) result.invite = { status: 'valid', redeemedAt: raw.invite.redeemedAt };
    else if (raw.invite.status !== 'valid') result.invite.status = raw.invite.status;
  }
  const profile = raw.profile;
  if (result.invite.status !== 'valid' || !object(profile) || !DEMO_ALIASES.includes(profile.alias)
    || !ACCESS_ROLES.includes(profile.role) || !timestamp(profile.createdAt) || profile.createdAt < result.invite.redeemedAt) return result;
  result.profile = { alias: profile.alias, role: profile.role, createdAt: profile.createdAt };
  const verification = raw.verification;
  if (!object(verification) || !verificationStatuses.includes(verification.status) || !object(verification.checks)) return result;
  const checks = Object.fromEntries(checkSteps.map(step => [step, verification.checks[step] === true]));
  // A later step cannot make an earlier sample check disappear.
  if ((!checks.identity && (checks.document || checks.selfie)) || (!checks.document && checks.selfie)) return result;
  const attempts = Number.isSafeInteger(verification.attempts) && verification.attempts >= 0 && verification.attempts <= 1_000_000 ? verification.attempts : 0;
  const submittedAt = timestamp(verification.submittedAt) && verification.submittedAt >= profile.createdAt ? verification.submittedAt : null;
  const reviewedAt = timestamp(verification.reviewedAt) && submittedAt !== null && verification.reviewedAt >= submittedAt ? verification.reviewedAt : null;
  const status = verification.status;
  if (status === 'not_started') {
    result.verification.attempts = attempts;
    return result;
  }
  if (['in_review', 'verified', 'rejected'].includes(status) && (!allChecked(checks) || submittedAt === null || attempts === 0)) return result;
  if (['verified', 'rejected', 'action_required'].includes(status) && reviewedAt === null) return result;
  if (status === 'action_required' && (!checks.identity || checks.document || checks.selfie || attempts === 0)) return result;
  result.verification = {
    status, step: status === 'action_required' ? 'document' : checkSteps.find(step => !checks[step]) || 'review',
    checks, attempts, submittedAt, reviewedAt,
  };
  return result;
}

export function loadAccessState(raw) {
  try { return migrateAccessState(typeof raw === 'string' ? JSON.parse(raw) : raw); }
  catch { return createAccessState(); }
}

export function accessSummary(raw) {
  const state = loadAccessState(raw);
  const registered = state.invite.status === 'valid' && state.profile !== null;
  const verified = registered && state.verification.status === 'verified';
  return {
    registered, verified, step: verified ? 'ready' : registered ? 'verification' : state.invite.status === 'valid' ? 'account' : 'invite',
    alias: state.profile?.alias ?? null, role: state.profile?.role ?? null,
    verificationStatus: state.verification.status, inviteStatus: state.invite.status,
  };
}

export const canTrade = state => accessSummary(state).verified;

export function redeemInvite(raw, code, now = Date.now()) {
  const state = loadAccessState(raw);
  if (state.invite.status === 'valid') fail('invite_already_redeemed');
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const status = normalized === DEMO_INVITE ? 'valid' : normalized === 'HANDSHAKE-EXPIRED' ? 'expired' : normalized === 'HANDSHAKE-USED' ? 'used' : 'invalid';
  state.invite = { status, redeemedAt: status === 'valid' ? time(now) : null };
  return state;
}

export function completeAccount(raw, input, now = Date.now()) {
  const state = loadAccessState(raw);
  if (state.invite.status !== 'valid') fail('invite_required');
  if (state.profile) fail('account_exists');
  if (!object(input) || !DEMO_ALIASES.includes(input.alias)) fail('alias_required');
  if (!ACCESS_ROLES.includes(input.role)) fail('role_required');
  const createdAt = time(now);
  if (createdAt < state.invite.redeemedAt) fail('invalid_time');
  state.profile = { alias: input.alias, role: input.role, createdAt };
  return state;
}

function registered(raw) {
  const state = loadAccessState(raw);
  if (!state.profile) fail('account_required');
  return state;
}

export function completeVerificationStep(raw, step, input, now = Date.now()) {
  const state = registered(raw);
  const verification = state.verification;
  if (!['not_started', 'in_progress', 'action_required'].includes(verification.status)) fail('verification_locked');
  if (!checkSteps.includes(step) || step !== verification.step) fail('step_out_of_order');
  if (!object(input) || input.confirmed !== true) fail('sample_confirmation_required');
  if (time(now) < Math.max(state.profile.createdAt, verification.reviewedAt ?? 0)) fail('invalid_time');
  verification.checks[step] = true;
  verification.step = checkSteps.find(item => !verification.checks[item]) || 'review';
  verification.status = 'in_progress';
  return state;
}

export function submitVerification(raw, now = Date.now()) {
  const state = registered(raw);
  const verification = state.verification;
  if (verification.status !== 'in_progress' || !allChecked(verification.checks) || verification.step !== 'review') fail('samples_incomplete');
  if (verification.attempts >= 1_000_000) fail('restart_demo');
  const submittedAt = time(now);
  if (submittedAt < Math.max(state.profile.createdAt, verification.reviewedAt ?? 0)) fail('invalid_time');
  verification.status = 'in_review';
  verification.attempts += 1;
  verification.submittedAt = submittedAt;
  verification.reviewedAt = null;
  return state;
}

export function demoReview(raw, outcome, now = Date.now()) {
  const state = registered(raw);
  const verification = state.verification;
  if (verification.status !== 'in_review') fail('review_not_pending');
  if (!['verified', 'action_required', 'rejected'].includes(outcome)) fail('invalid_review_result');
  const reviewedAt = time(now);
  if (reviewedAt < verification.submittedAt) fail('invalid_time');
  verification.status = outcome;
  verification.reviewedAt = reviewedAt;
  if (outcome === 'action_required') {
    verification.checks.document = false;
    verification.checks.selfie = false;
    verification.step = 'document';
  }
  return state;
}

export function restartVerification(raw) {
  const state = registered(raw);
  if (state.verification.status !== 'rejected') fail('restart_not_allowed');
  state.verification = { ...blankVerification(), attempts: state.verification.attempts };
  return state;
}
