import { NextResponse } from 'next/server';
import { storeBackend, storeIsDurable } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health and configuration, safe to expose publicly: no secrets, just enough
 * for an operator to see why something is misconfigured.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'nightdesk',
    chain: 'base',
    dryRun: process.env.NEXT_PUBLIC_DRY_RUN === '1',
    hasFlashKey: Boolean(process.env.FLASH_API_KEY),
    /** The public docs key works, but integrator fees accrue to Definitive. */
    usingPublicFlashKey: (process.env.FLASH_API_KEY ?? '').startsWith('dpka_513a2bd7'),
    integratorFeeBps: process.env.INTEGRATOR_FEE_BPS ?? '25',
    maxSpendUsd: Number(process.env.MAX_SPEND_USD ?? 250),
    minSpendUsd: Number(process.env.MIN_SPEND_USD ?? 1),
    store: {
      backend: storeBackend(),
      durable: storeIsDurable(),
      hint: storeIsDurable()
        ? 'Mirrors persist across restarts and deploys.'
        : 'Mirrors are stored on the local filesystem, which is ephemeral on serverless hosts. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before deploying, or an empty board is expected after a redeploy.',
    },
    attribution: process.env.ERC8021_ATTRIBUTION_CODE ? 'configured' : 'not set',
  });
}
