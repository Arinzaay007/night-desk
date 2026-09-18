/**
 * Site-wide constants.
 *
 * The plan id is public — it IS the plan, encoded in the URL — so it is safe to
 * ship in the bundle. Everything links to the one real mirror rather than a
 * sample route, because a footer link to a plan that does not exist is the
 * first thing a reviewer clicks.
 */

export const REPO_URL = 'https://github.com/Arinzaay007/night-desk';

/** The live plan id. Read from the seeded ledger, verified against /api/proof. */
export const PLAN_ID = 'eyJ2IjoxLCJhIjoiMHg1OWY4MDY0MTI3OGY1NTRhYTkyMWNiYzY1NDdjMTgyM2FhZmUyZmIyIiwidCI6IjB4YjIwMDAwMDAwMDAwMDAwMDAwMDAwMDc4ZWU3Y2UyZmU0OTA4MTA4YyIsInMiOiJOVkRBYyIsImUiOiJtYXJrZXQiLCJ6IjoxMDAsInRwIjoyMCwic2wiOjgsInRzIjoxNzg5NzQxMzY0OTM3LCJtIjoidGhlIGdyZWF0In0';

/** Short key used by /api/proof — NOT the long id. */
export const PLAN_KEY = 'u8201h';

export const PLAN_PATH = `/p/${PLAN_ID}`;

export const SUBMISSION_URL = 'https://runtime.nyc/submit';
export const SOCIAL_URL = 'https://x.com/DefinitiveFi';
