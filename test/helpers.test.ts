// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	accountOptions,
	apiErrorMessage,
	BASE_URL,
	bearer,
	buildCreatePostBody,
	buildListPostsQuery,
	buildRequest,
	splitList,
	toIsoDate,
} from '../nodes/MbxFlow/helpers';
import { MbxFlowApi } from '../credentials/MbxFlowApi.credentials';

test('buildRequest: GET has base URL, Accept header, no body and no Content-Type', () => {
	const r = buildRequest('GET', '/accounts');
	assert.equal(r.baseURL, 'https://app.mbxflow.com/api/v1');
	assert.equal(r.baseURL, BASE_URL);
	assert.equal(r.url, '/accounts');
	assert.equal(r.method, 'GET');
	assert.deepEqual(r.headers, { Accept: 'application/json' });
	assert.equal(r.body, undefined);
	assert.equal(r.qs, undefined);
	assert.equal(r.json, true);
	assert.equal(r.returnFullResponse, true);
	assert.equal(r.ignoreHttpStatusErrors, true);
});

test('buildRequest: POST sends JSON body and Content-Type, adds a leading slash', () => {
	const r = buildRequest('POST', 'posts', { body: { text: 'hi' } });
	assert.equal(r.url, '/posts');
	assert.equal(r.headers['Content-Type'], 'application/json');
	assert.deepEqual(r.body, { text: 'hi' });
});

test('buildRequest: query parameters are passed through', () => {
	const r = buildRequest('GET', '/posts', { qs: { status: 'failed', limit: 100 } });
	assert.deepEqual(r.qs, { status: 'failed', limit: 100 });
});

test('credential: Bearer header, password field, GET /me test', () => {
	const cred = new MbxFlowApi();
	assert.equal(cred.name, 'mbxFlowApi');
	assert.equal(cred.displayName, 'MBX Flow API');
	assert.equal(cred.properties[0].typeOptions?.password, true);
	assert.equal(cred.authenticate.properties.headers?.Authorization, '=Bearer {{$credentials.apiKey}}');
	assert.equal(cred.test.request.baseURL, BASE_URL);
	assert.equal(cred.test.request.url, '/me');
	assert.equal(bearer('  mbx_abc  '), 'Bearer mbx_abc');
});

test('buildListPostsQuery: status filter and limit bounds', () => {
	assert.deepEqual(buildListPostsQuery('published', 10), { status: 'published', limit: 10 });
	assert.deepEqual(buildListPostsQuery('', 10), { limit: 10 });
	assert.deepEqual(buildListPostsQuery('bogus', 10), { limit: 10 });
	assert.deepEqual(buildListPostsQuery('draft', 500), { status: 'draft', limit: 100 });
	assert.deepEqual(buildListPostsQuery(undefined, 0), { limit: 50 });
	assert.deepEqual(buildListPostsQuery('failed', 2.5), { status: 'failed', limit: 50 });
});

test('buildCreatePostBody: a draft never carries scheduledAt', () => {
	const body = buildCreatePostBody('draft', {
		text: 'Hello',
		scheduledAt: '2030-01-01T00:00:00Z',
		accountIds: [],
		mediaUrls: '',
	});
	assert.deepEqual(body, { text: 'Hello' });
	assert.equal('publishNow' in body, false);
});

test('buildCreatePostBody: draft with accounts and media', () => {
	const body = buildCreatePostBody('draft', {
		text: 'Hello',
		accountIds: ['a1', 'a2', 'a1'],
		mediaUrls: 'https://x.test/1.jpg,\nhttps://x.test/2.jpg',
	});
	assert.deepEqual(body, {
		text: 'Hello',
		accountIds: ['a1', 'a2'],
		mediaUrls: ['https://x.test/1.jpg', 'https://x.test/2.jpg'],
	});
});

test('buildCreatePostBody: schedule converts the date to ISO UTC', () => {
	const body = buildCreatePostBody('schedule', {
		text: 'Later',
		accountIds: ['a1'],
		scheduledAt: '2030-10-01T18:30:00.000+02:00',
	});
	assert.deepEqual(body, { text: 'Later', accountIds: ['a1'], scheduledAt: '2030-10-01T16:30:00.000Z' });
});

test('buildCreatePostBody: schedule without a valid date throws', () => {
	assert.throws(() => buildCreatePostBody('schedule', { text: 'x', accountIds: ['a'], scheduledAt: '' }));
	assert.throws(() => buildCreatePostBody('schedule', { text: 'x', accountIds: ['a'], scheduledAt: 'nope' }));
});

test('toIsoDate: accepts Date and Luxon-like objects', () => {
	assert.equal(toIsoDate(new Date('2030-01-01T00:00:00Z')), '2030-01-01T00:00:00.000Z');
	assert.equal(toIsoDate({ toISO: () => '2030-01-01T01:00:00+01:00' }), '2030-01-01T00:00:00.000Z');
});

test('splitList: arrays, commas, newlines, blanks and duplicates', () => {
	assert.deepEqual(splitList(' a, b\n\nc ,a'), ['a', 'b', 'c']);
	assert.deepEqual(splitList(['x', '', ' y ', 3]), ['x', 'y']);
	assert.deepEqual(splitList(undefined), []);
});

test('accountOptions: label is "Name (Network)"', () => {
	assert.deepEqual(
		accountOptions([
			{ id: '1', network: 'bluesky', networkName: 'Bluesky', name: 'DJ Time', username: 'dj' },
			{ id: '2', network: 'mastodon', name: 'Label' },
		]),
		[
			{ name: 'DJ Time (Bluesky)', value: '1' },
			{ name: 'Label (mastodon)', value: '2' },
		],
	);
});

test('apiErrorMessage: uses the API "error" text first', () => {
	assert.equal(apiErrorMessage(400, { error: 'scheduledAt must be at least 10 minutes from now.' }),
		'scheduledAt must be at least 10 minutes from now.');
	assert.equal(apiErrorMessage(404, '{"error":"Post not found."}'), 'Post not found.');
	assert.match(apiErrorMessage(401, {}), /key is not valid/);
	assert.match(apiErrorMessage(402, null), /Pro plan/);
	assert.equal(apiErrorMessage(402, { error: 'Your workspace is paused.', code: 'org_suspended' }), 'Your workspace is paused.');
	assert.equal(apiErrorMessage(502, '<html>'), 'MBX Flow answered with status 502.');
});
