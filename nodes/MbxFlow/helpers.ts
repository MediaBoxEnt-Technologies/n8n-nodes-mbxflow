// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.

export const BASE_URL = 'https://app.mbxflow.com/api/v1';

export const POST_STATUSES = ['draft', 'scheduled', 'published', 'failed'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 50;

export type HttpMethod = 'GET' | 'POST';

export interface ApiRequest {
	method: HttpMethod;
	baseURL: string;
	url: string;
	headers: Record<string, string>;
	qs?: Record<string, string | number>;
	body?: Record<string, unknown>;
	json: true;
	returnFullResponse: true;
	ignoreHttpStatusErrors: true;
}

/** The request n8n sends. The Authorization header is added by the credential. */
export function buildRequest(
	method: HttpMethod,
	path: string,
	options: { qs?: Record<string, string | number>; body?: Record<string, unknown> } = {},
): ApiRequest {
	const request: ApiRequest = {
		method,
		baseURL: BASE_URL,
		url: path.startsWith('/') ? path : `/${path}`,
		headers: { Accept: 'application/json' },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (options.qs && Object.keys(options.qs).length) request.qs = options.qs;
	if (options.body !== undefined) {
		request.headers['Content-Type'] = 'application/json';
		request.body = options.body;
	}
	return request;
}

/** The value of the Authorization header for a key. */
export function bearer(apiKey: string): string {
	return `Bearer ${apiKey.trim()}`;
}

/** Query for GET /posts. An empty status means every status. */
export function buildListPostsQuery(status: string | undefined, limit: number | undefined): Record<string, string | number> {
	const qs: Record<string, string | number> = {};
	if (status && (POST_STATUSES as readonly string[]).includes(status)) qs.status = status;
	const n = Number(limit);
	qs.limit = Number.isInteger(n) && n > 0 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
	return qs;
}

/** Media URLs typed as one per line or separated by commas. */
export function splitList(value: unknown): string[] {
	const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/) : [];
	const out: string[] = [];
	for (const part of parts) {
		if (typeof part !== 'string') continue;
		const trimmed = part.trim();
		if (trimmed && !out.includes(trimmed)) out.push(trimmed);
	}
	return out;
}

/** A date from n8n (string, Luxon or JS date) as an ISO string. */
export function toIsoDate(value: unknown): string {
	let date: Date;
	if (value instanceof Date) date = value;
	else if (value && typeof value === 'object' && typeof (value as { toISO?: unknown }).toISO === 'function') {
		date = new Date(String((value as { toISO: () => string }).toISO()));
	} else if (typeof value === 'string' && value.trim()) date = new Date(value.trim());
	else throw new Error('Pick a date and time for Scheduled At.');
	if (isNaN(date.getTime())) throw new Error('Scheduled At must be a date and time like 2026-10-01T18:30:00Z.');
	return date.toISOString();
}

export interface PostFields {
	text: string;
	accountIds?: unknown;
	mediaUrls?: unknown;
	scheduledAt?: unknown;
}

/** The JSON body for POST /posts: a draft never carries scheduledAt. */
export function buildCreatePostBody(mode: 'draft' | 'schedule', fields: PostFields): Record<string, unknown> {
	const body: Record<string, unknown> = { text: typeof fields.text === 'string' ? fields.text : '' };
	const accountIds = splitList(fields.accountIds);
	const mediaUrls = splitList(fields.mediaUrls);
	if (accountIds.length) body.accountIds = accountIds;
	if (mediaUrls.length) body.mediaUrls = mediaUrls;
	if (mode === 'schedule') body.scheduledAt = toIsoDate(fields.scheduledAt);
	return body;
}

export interface Account {
	id: string;
	network: string;
	networkName?: string;
	name: string;
	username?: string | null;
}

/** Options for the Accounts dropdown: "Name (Network)". */
export function accountOptions(accounts: Account[]): Array<{ name: string; value: string }> {
	return accounts.map((a) => ({ name: `${a.name} (${a.networkName || a.network})`, value: a.id }));
}

const FALLBACK_MESSAGES: Record<number, string> = {
	400: 'MBX Flow did not accept this request.',
	401: 'This key is not valid. Create a new one in MBX Flow: Settings, Integrations, Connected apps.',
	402: 'Connected apps are included from the MBX Flow Pro plan.',
	403: 'This key is not allowed to do that.',
	404: 'Not found in MBX Flow.',
	429: 'Too many requests. Wait a moment and try again.',
};

/** The error text to show: the API's own "error" field when there is one. */
export function apiErrorMessage(statusCode: number, body: unknown): string {
	if (body && typeof body === 'object') {
		const err = (body as { error?: unknown }).error;
		if (typeof err === 'string' && err.trim()) return err.trim();
		if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
			return (err as { message: string }).message;
		}
	}
	if (typeof body === 'string' && body.trim()) {
		try {
			return apiErrorMessage(statusCode, JSON.parse(body));
		} catch {
			// Not JSON: fall through to the generic message.
		}
	}
	return FALLBACK_MESSAGES[statusCode] ?? `MBX Flow answered with status ${statusCode}.`;
}

export function isErrorStatus(statusCode: number): boolean {
	return !(statusCode >= 200 && statusCode < 300);
}

// ---- Trigger: which posts are new ---------------------------------------

export interface PublicPost {
	id: string;
	status: string;
	[key: string]: unknown;
}

export interface TriggerState {
	event?: string;
	seenIds?: string[];
}

export interface PollResult {
	emit: PublicPost[];
	state: { event: string; seenIds: string[] };
	initialized: boolean;
}

export const MAX_SEEN = 1000;

/** What one poll emits. The first poll only remembers what is there; new posts come out oldest first. */
export function processPoll(
	previous: TriggerState | undefined,
	event: string,
	posts: PublicPost[],
	isManual: boolean,
	maxSeen = MAX_SEEN,
): PollResult {
	const valid = posts.filter((p) => p && typeof p.id === 'string' && p.id);
	const ids = valid.map((p) => p.id);
	const sample = isManual && valid.length ? [valid[0]] : [];

	const fresh = !previous || previous.event !== event || !Array.isArray(previous.seenIds);
	if (fresh) {
		return { emit: sample, state: { event, seenIds: unique(ids).slice(0, maxSeen) }, initialized: true };
	}

	const seen = new Set(previous.seenIds);
	const newPosts = valid.filter((p) => !seen.has(p.id));
	const newIds = unique(newPosts.map((p) => p.id));
	const seenIds = unique([...newIds, ...(previous.seenIds as string[])]).slice(0, maxSeen);
	const emit = newPosts.length ? dedupeById(newPosts).reverse() : sample;
	return { emit, state: { event, seenIds }, initialized: false };
}

function unique(ids: string[]): string[] {
	return Array.from(new Set(ids));
}

function dedupeById(posts: PublicPost[]): PublicPost[] {
	const seen = new Set<string>();
	return posts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

export function statusForEvent(event: string): PostStatus {
	return event === 'postFailed' ? 'failed' : 'published';
}
