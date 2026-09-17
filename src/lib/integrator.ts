import { createHash } from 'node:crypto';

/**
 * Whose integrator fee is this?
 *
 * Flash pays the integrator that owns the API key. Definitive publishes a
 * prefilled demo key that works immediately — their own words: *"If you only
 * want to trade, skip the signup flow — call the API directly with the prefilled
 * Definitive integrator key"* — and the getting-started guide prints it in full.
 *
 * So a build running on that key is charging a real integrator fee that accrues
 * to Definitive, not to the person who wrote the app. Nothing errors; the fee is
 * simply not yours. That is a silent failure, which is why it gets checked here
 * rather than being left to a README paragraph.
 *
 * The API does not echo which integrator a key belongs to, so identity has to be
 * inferred from the key string itself. That is only trustworthy if the
 * comparison is exact, hence matching against the full published key rather than
 * a guessed prefix — a prefix test would mislabel a rotated public key as "your
 * own", which is the one direction of error that costs money.
 */

/** The prefilled demo key, as printed in Definitive's getting-started guide. */
export const PUBLIC_FLASH_KEY = 'dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b';

/** Account prefix of the public key, for a looser match on partial values. */
const PUBLIC_PREFIX = PUBLIC_FLASH_KEY.slice(0, PUBLIC_FLASH_KEY.indexOf('_', 5) + 1);

export type KeyIdentity = 'public' | 'own' | 'missing' | 'malformed';

const key = (): string => (process.env.FLASH_API_KEY ?? '').trim();

export function keyIdentity(): KeyIdentity {
  const value = key();
  if (!value) return 'missing';
  if (!value.startsWith('dpka_')) return 'malformed';
  if (value === PUBLIC_FLASH_KEY) return 'public';
  // A rotated public key would not match the full string but would keep the
  // account prefix. Erring toward "public" costs a warning, not revenue.
  if (value.startsWith(PUBLIC_PREFIX)) return 'public';
  return 'own';
}

export const isPublicKey = (): boolean => keyIdentity() === 'public';

/**
 * A short, non-reversible fingerprint of the loaded key.
 *
 * Surfaced so an operator can confirm *which* key the server is using without
 * anything secret leaving the process — the whole key never appears in a
 * response. Anyone can reproduce it with:
 *   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex').slice(0,8))" "$FLASH_API_KEY"
 */
export function keyFingerprint(): string | null {
  const value = key();
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

export interface IntegratorStatus {
  identity: KeyIdentity;
  fingerprint: string | null;
  /** Whose Flash Portfolio the integrator fee lands in. */
  feesAccrueTo: string;
  /** True when the fee is this deployment's to keep. */
  earning: boolean;
  hint: string;
}

export function integratorStatus(): IntegratorStatus {
  const identity = keyIdentity();
  const fingerprint = keyFingerprint();

  if (identity === 'missing') {
    return {
      identity,
      fingerprint: null,
      feesAccrueTo: 'nobody — no key is loaded',
      earning: false,
      hint: 'Set FLASH_API_KEY. Nothing can quote without it.',
    };
  }

  if (identity === 'malformed') {
    return {
      identity,
      fingerprint,
      feesAccrueTo: 'unknown — the key is not in the expected format',
      earning: false,
      hint: 'Flash keys begin with dpka_. Check FLASH_API_KEY for a copy-paste error.',
    };
  }

  if (identity === 'public') {
    return {
      identity,
      fingerprint,
      feesAccrueTo: "Definitive's demo integrator",
      earning: false,
      hint:
        'This is the prefilled key from Definitive\u2019s docs. Fine for building and recording a demo — ' +
        'integrator fees are simply not yours. For your own revenue: app.definitive.fi → sign in with an ' +
        'email → More → Flash → Create Flash Key, then set FLASH_API_KEY and restart.',
    };
  }

  return {
    identity,
    fingerprint,
    feesAccrueTo: 'this deployment',
    earning: true,
    hint: 'Your own integrator key is loaded. Fees accrue to your Flash Portfolio.',
  };
}
