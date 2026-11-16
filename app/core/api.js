// make.fun's public API: read-only GETs, nothing signed in, nothing written.
//
// Every call here asks for the narrow form of its endpoint, because the wide ones are enormous:
// the board is 1.0 MB whole and 187 KB with `status=open&activity=times&limit=12`; a bounty is
// 1.8 MB whole and 92 KB with `submissions=summary`; a leaderboard sends 10 full entries and the
// rest in a light form with `rows=first` instead of every column of every entry. Answers are kept
// for a minute, so going back to the board or between a bounty and its leaderboard costs nothing.

const BASE = 'https://make.fun/api';

/** How many bounties a page of the board holds. */
export const BOARD_PAGE = 12;
/** How long an answer is reused before it is fetched again. */
const FRESH_MS = 60_000;
/** A leaderboard is built on demand; the API answers 503 while it builds, and asks to be retried. */
const RETRIES = 2;

const answers = new Map();

/** An API call that came back with a problem: `status` and the API's own `detail`. */
export class ApiError extends Error {
  constructor(status, detail, path) {
    super(detail || `make.fun's API answered ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

async function read(path, { signal } = {}) {
  const fresh = answers.get(path);
  if (fresh && Date.now() - fresh.at < FRESH_MS) return fresh.data;

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(BASE + path, { signal, headers: { accept: 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      answers.set(path, { at: Date.now(), data });
      return data;
    }
    const problem = await response.json().catch(() => null);
    const again = response.status === 503 && attempt < RETRIES;
    if (!again) throw new ApiError(response.status, problem?.detail, path);
    const after = Number(problem?.retry_after ?? response.headers.get('retry-after') ?? 2);
    await new Promise((resolve) => setTimeout(resolve, Math.min(5, Math.max(1, after)) * 1000));
  }
}

const query = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();

/**
 * A page of the board: `{ items, next_cursor }`. `activity=times` drops the per-submission detail
 * a board never shows and keeps the timestamps it draws its activity from.
 */
export const getBoard = ({ status = 'open', category, cursor, limit = BOARD_PAGE } = {}, options) =>
  read(`/competitions?${query({ status, category, cursor, limit, activity: 'times' })}`, options);

/** One bounty, whole but for its submissions, which come back as counts. */
export const getBounty = (slug, options) =>
  read(`/competitions/${encodeURIComponent(slug)}?submissions=summary`, options);

/** A bounty's leaderboard: `entries` in full, `rest` in a light form, and the columns to show. */
export const getLeaderboard = (slug, { phase, view } = {}, options) =>
  read(`/competitions/${encodeURIComponent(slug)}/leaderboard?${query({ rows: 'first', phase, view })}`, options);

/** An account's public profile: its record, its entries and its payouts. */
export const getProfile = (handle, options) =>
  read(`/profiles/${encodeURIComponent(handle)}`, options);
