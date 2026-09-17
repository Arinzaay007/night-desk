import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * The mirror ledger, with three interchangeable backends.
 *
 * Plan VIEWING never touches this store — plans live in the URL — so losing the
 * ledger can never break a shared link. It only powers the board, mirror counts
 * and the proof panel's list of who to look up.
 *
 * Backends, chosen automatically:
 *
 *   1. Upstash Redis (REST)  — set UPSTASH_REDIS_REST_URL + ..._TOKEN.
 *                              Durable, works on serverless hosts. No SDK, just fetch.
 *   2. File (`./.data/store.json`) — the default locally. NOT durable on
 *                              serverless: the filesystem is ephemeral, so an
 *                              empty board after deploy is the expected failure.
 *   3. In-memory             — last resort, per-process only.
 *
 * Deploying to Vercel without (1) is the single easiest way to hand a judge an
 * empty board, so the choice is surfaced in /api/health and logged once.
 */

export interface MirrorRecord {
  planKey: string;
  /**
   * The base64url shareable link for this plan (the `/p/<id>` id). Optional
   * because records written before this field existed do not have it.
   */
  planId?: string;
  symbol: string;
  funder: string;
  orderId: string;
  bracketOrderId?: string | null;
  spendUsd: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  createdAt: number;
  /** Set by the author's own publish, so the board can show authorship. */
  author?: string;
  note?: string;
  sizePct?: number;
  tpPct?: number;
  slPct?: number;
}

interface StoreShape {
  mirrors: MirrorRecord[];
}

const LEDGER_KEY = 'nightdesk:mirrors';
const MAX_RECORDS = 500;

const STORE_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');
const STORE_FILE = path.join(STORE_DIR, 'store.json');

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = Boolean(upstashUrl && upstashToken);

const memory: StoreShape = { mirrors: [] };
let fileAvailable = true;

export type StoreBackend = 'upstash' | 'file' | 'memory';
export const storeBackend = (): StoreBackend =>
  useUpstash ? 'upstash' : fileAvailable ? 'file' : 'memory';

/* ----------------------------- Upstash REST ----------------------------- */

async function upstashCommand<T = unknown>(command: (string | number)[]): Promise<T | null> {
  const response = await fetch(upstashUrl!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Upstash responded ${response.status}`);
  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload.result ?? null;
}

/* -------------------------------- reads -------------------------------- */

async function read(): Promise<StoreShape> {
  if (useUpstash) {
    try {
      const raw = await upstashCommand<string>(['GET', LEDGER_KEY]);
      if (!raw) return { mirrors: [] };
      const parsed = JSON.parse(raw) as StoreShape;
      return { mirrors: Array.isArray(parsed.mirrors) ? parsed.mirrors : [] };
    } catch {
      return { mirrors: [] };
    }
  }

  if (!fileAvailable) return memory;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    return { mirrors: Array.isArray(parsed.mirrors) ? parsed.mirrors : [] };
  } catch {
    return memory;
  }
}

/* -------------------------------- writes ------------------------------- */

async function write(data: StoreShape): Promise<void> {
  const bounded: StoreShape = {
    mirrors: data.mirrors.length > MAX_RECORDS ? data.mirrors.slice(-MAX_RECORDS) : data.mirrors,
  };
  memory.mirrors = bounded.mirrors;

  if (useUpstash) {
    // A read-modify-write race could lose a concurrent mirror. Acceptable here:
    // this is a demo ledger, and Flash remains the source of truth for orders.
    await upstashCommand(['SET', LEDGER_KEY, JSON.stringify(bounded)]);
    return;
  }

  if (!fileAvailable) return;
  try {
    await fs.mkdir(STORE_DIR, { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(bounded, null, 2), 'utf8');
  } catch {
    // Ephemeral or read-only filesystem (serverless). Degrade, do not throw.
    fileAvailable = false;
  }
}

/* -------------------------------- public ------------------------------- */

export async function recordMirror(record: MirrorRecord): Promise<void> {
  const data = await read();
  data.mirrors.push(record);
  await write(data);
}

export async function listMirrors(): Promise<MirrorRecord[]> {
  const data = await read();
  return [...data.mirrors].sort((a, b) => b.createdAt - a.createdAt);
}

export async function mirrorsForPlan(planKeyValue: string): Promise<MirrorRecord[]> {
  const all = await listMirrors();
  return all.filter(m => m.planKey === planKeyValue);
}

/**
 * Whether mirrors will survive a redeploy. Surfaced so an empty board on a
 * deployed build is diagnosable in one request rather than a mystery.
 */
export function storeIsDurable(): boolean {
  return useUpstash;
}
