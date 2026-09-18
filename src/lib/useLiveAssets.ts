'use client';

import { useEffect, useState } from 'react';

/**
 * Live equity prices for the hero card.
 *
 * The asset table ships a last-known price so the page paints instantly, but a
 * seed value rendered next to a live market is still a stale number presented
 * as a current one. This reads the real feed and returns `null` until it
 * arrives, so the UI can distinguish "we have a price" from "we have a price
 * from a minute ago" instead of blurring the two.
 *
 * One request, shared by every consumer on the page.
 */

export interface LiveAsset {
  symbol: string;
  price: number;
  change24h: number;
}

let cache: { at: number; data: Record<string, LiveAsset> } | null = null;
const TTL_MS = 20_000;

export function useLiveAssets(): Record<string, LiveAsset> | null {
  const [data, setData] = useState<Record<string, LiveAsset> | null>(() => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
    return null;
  });

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) {
      setData(cache.data);
      return;
    }

    let cancelled = false;
    fetch('/api/assets')
      .then(r => r.json())
      .then((payload: { ok?: boolean; assets?: LiveAsset[] }) => {
        if (cancelled || !payload?.ok || !payload.assets?.length) return;
        const map: Record<string, LiveAsset> = {};
        for (const a of payload.assets) {
          if (a.symbol && Number.isFinite(a.price) && a.price > 0) map[a.symbol] = a;
        }
        cache = { at: Date.now(), data: map };
        setData(map);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
