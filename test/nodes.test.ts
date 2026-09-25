// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
//
// Drives the real node classes with a fake n8n context: what goes out over
// the wire, and how the API's own error text comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MbxFlow } from '../nodes/MbxFlow/MbxFlow.node';
import { MbxFlowTrigger } from '../nodes/MbxFlowTrigger/MbxFlowTrigger.node';

interface Call {
	credential: string;
	options: Record<string, unknown>;
}

function fakeContext(params: Record<string, unknown>, reply: { statusCode: number; body: unknown }, extra: Record<string, unknown> = {}) {
	const calls: Call[] = [];
	const ctx = {
		calls,
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name: string, _i?: number, fallback?: unknown) => (name in params ? params[name] : fallback),
		getNode: () => ({ name: 'MBX Flow', type: 'n8n-nodes-mbxflow.mbxFlow', typeVersion: 1, position: [0, 0], parameters: {} }),
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: async (credential: string, options: Record<string, unknown>) => {
				calls.push({ credential, options });
				return { statusCode: reply.statusCode, headers: {}, body: reply.body };
			},
			returnJsonArray: (data: unknown[]) => data.map((json) => ({ json })),
			constructExecutionMetaData: (items: unknown[], meta: { itemData: unknown }) =>
				items.map((it) => ({ ...(it as object), pairedItem: meta.itemData })),
		},
		...extra,
	};
	return ctx;
}

const post = { id: 'p1', status: 'draft', text: 'Hello', mediaUrls: [], scheduledAt: null, publishedAt: null, createdAt: '2026-09-24T00:00:00.000Z', accounts: [] };

test('Create Draft: POST /posts with text only, uses the MBX Flow credential', async () => {
	const ctx = fakeContext({ resource: 'post', operation: 'createDraft', text: 'Hello', additionalFields: {} }, { statusCode: 201, body: { post } });
	const out = await new MbxFlow().execute.call(ctx as never);
	assert.equal(ctx.calls.length, 1);
	const { credential, options } = ctx.calls[0];
	assert.equal(credential, 'mbxFlowApi');
	assert.equal(options.method, 'POST');
	assert.equal(options.url, '/posts');
	assert.deepEqual(options.body, { text: 'Hello' });
	assert.deepEqual(out[0].map((x) => x.json), [post]);
});

test('Schedule: POST /posts with accountIds, media and ISO scheduledAt', async () => {
	const ctx = fakeContext(
		{
			resource: 'post',
			operation: 'schedule',
			text: 'Later',
			accountIds: ['a1'],
			scheduledAt: '2030-10-01T18:30:00Z',
			scheduleFields: { mediaUrls: 'https://x.test/a.jpg' },
		},
		{ statusCode: 201, body: { post: { ...post, status: 'scheduled' } } },
	);
	await new MbxFlow().execute.call(ctx as never);
	assert.deepEqual(ctx.calls[0].options.body, {
		text: 'Later',
		accountIds: ['a1'],
		mediaUrls: ['https://x.test/a.jpg'],
		scheduledAt: '2030-10-01T18:30:00.000Z',
	});
});

test('Get Many posts: status and limit go in the query string', async () => {
	const ctx = fakeContext({ resource: 'post', operation: 'getAll', status: 'failed', limit: 5 }, { statusCode: 200, body: { posts: [post, { ...post, id: 'p2' }] } });
	const out = await new MbxFlow().execute.call(ctx as never);
	assert.equal(ctx.calls[0].options.method, 'GET');
	assert.equal(ctx.calls[0].options.url, '/posts');
	assert.deepEqual(ctx.calls[0].options.qs, { status: 'failed', limit: 5 });
	assert.equal(out[0].length, 2);
});

test('Get: the post id is URL-encoded into the path', async () => {
	const ctx = fakeContext({ resource: 'post', operation: 'get', postId: ' a/b ' }, { statusCode: 200, body: { post } });
	await new MbxFlow().execute.call(ctx as never);
	assert.equal(ctx.calls[0].options.url, '/posts/a%2Fb');
});

test('an API error shows the API "error" text', async () => {
	const ctx = fakeContext(
		{ resource: 'post', operation: 'get', postId: 'nope' },
		{ statusCode: 404, body: { error: 'Post not found.' } },
	);
	await assert.rejects(new MbxFlow().execute.call(ctx as never), (err: Error & { httpCode?: string }) => {
		assert.equal(err.message, 'Post not found.');
		assert.equal(err.httpCode, '404');
		return true;
	});
});

test('Accounts dropdown loads GET /accounts as "Name (Network)"', async () => {
	const ctx = fakeContext({}, { statusCode: 200, body: { accounts: [{ id: 'a1', network: 'bluesky', networkName: 'Bluesky', name: 'DJ', username: null }] } });
	const options = await new MbxFlow().methods.loadOptions.getAccounts.call(ctx as never);
	assert.equal(ctx.calls[0].options.url, '/accounts');
	assert.deepEqual(options, [{ name: 'DJ (Bluesky)', value: 'a1' }]);
});

test('Trigger: first poll initializes, second emits only the new post', async () => {
	const staticData: Record<string, unknown> = {};
	const make = (posts: unknown[]) =>
		fakeContext({ event: 'postPublished' }, { statusCode: 200, body: { posts } }, {
			getWorkflowStaticData: () => staticData,
			getMode: () => 'trigger',
		});
	const trigger = new MbxFlowTrigger();

	const first = make([{ id: 'a', status: 'published' }]);
	assert.equal(await trigger.poll.call(first as never), null);
	assert.deepEqual(first.calls[0].options.qs, { status: 'published', limit: 100 });
	assert.deepEqual(staticData.seenIds, ['a']);

	const second = make([{ id: 'b', status: 'published' }, { id: 'a', status: 'published' }]);
	const out = await trigger.poll.call(second as never);
	assert.deepEqual(out?.[0].map((x) => x.json.id), ['b']);
	assert.deepEqual(staticData.seenIds, ['b', 'a']);
});

test('Trigger: Post Failed polls status=failed', async () => {
	const ctx = fakeContext({ event: 'postFailed' }, { statusCode: 200, body: { posts: [] } }, {
		getWorkflowStaticData: () => ({}),
		getMode: () => 'trigger',
	});
	await new MbxFlowTrigger().poll.call(ctx as never);
	assert.deepEqual(ctx.calls[0].options.qs, { status: 'failed', limit: 100 });
});

test('a 402 (plan required) shows the API "error" text', async () => {
	const ctx = fakeContext(
		{ resource: 'account', operation: 'getAll' },
		{ statusCode: 402, body: { error: 'Connected apps are included from the Pro plan.', code: 'plan_required' } },
	);
	await assert.rejects(new MbxFlow().execute.call(ctx as never), (err: Error & { httpCode?: string }) => {
		assert.equal(err.message, 'Connected apps are included from the Pro plan.');
		assert.equal(err.httpCode, '402');
		return true;
	});
});
