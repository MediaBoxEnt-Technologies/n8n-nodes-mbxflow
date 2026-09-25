// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { processPoll, statusForEvent, type PublicPost } from '../nodes/MbxFlow/helpers';

const p = (id: string, status = 'published'): PublicPost => ({ id, status });

test('statusForEvent maps events to API statuses', () => {
	assert.equal(statusForEvent('postPublished'), 'published');
	assert.equal(statusForEvent('postFailed'), 'failed');
});

test('first run only remembers what is there and emits nothing', () => {
	const r = processPoll(undefined, 'postPublished', [p('c'), p('b'), p('a')], false);
	assert.deepEqual(r.emit, []);
	assert.equal(r.initialized, true);
	assert.deepEqual(r.state, { event: 'postPublished', seenIds: ['c', 'b', 'a'] });
});

test('first run in manual mode returns the latest post as a sample', () => {
	const r = processPoll(undefined, 'postPublished', [p('c'), p('b')], true);
	assert.deepEqual(r.emit, [p('c')]);
});

test('first run with no posts emits nothing even in manual mode', () => {
	const r = processPoll(undefined, 'postFailed', [], true);
	assert.deepEqual(r.emit, []);
	assert.deepEqual(r.state.seenIds, []);
});

test('later runs emit only new posts, oldest first', () => {
	const first = processPoll(undefined, 'postPublished', [p('b'), p('a')], false);
	const second = processPoll(first.state, 'postPublished', [p('d'), p('c'), p('b'), p('a')], false);
	assert.deepEqual(second.emit.map((x) => x.id), ['c', 'd']);
	assert.deepEqual(second.state.seenIds, ['d', 'c', 'b', 'a']);
	const third = processPoll(second.state, 'postPublished', [p('d'), p('c'), p('b')], false);
	assert.deepEqual(third.emit, []);
	assert.equal(third.initialized, false);
});

test('a post that dropped out of the list and comes back is not emitted again', () => {
	const state = { event: 'postPublished', seenIds: ['x', 'y'] };
	const r = processPoll(state, 'postPublished', [p('y')], false);
	assert.deepEqual(r.emit, []);
	assert.deepEqual(r.state.seenIds, ['x', 'y']);
});

test('duplicate ids in one answer are emitted once', () => {
	const state = { event: 'postPublished', seenIds: ['a'] };
	const r = processPoll(state, 'postPublished', [p('b'), p('b'), p('a')], false);
	assert.deepEqual(r.emit.map((x) => x.id), ['b']);
	assert.deepEqual(r.state.seenIds, ['b', 'a']);
});

test('manual mode with nothing new returns the latest as a sample', () => {
	const state = { event: 'postPublished', seenIds: ['a'] };
	const r = processPoll(state, 'postPublished', [p('a')], true);
	assert.deepEqual(r.emit, [p('a')]);
});

test('changing the event starts over instead of emitting the other list', () => {
	const state = { event: 'postPublished', seenIds: ['a'] };
	const r = processPoll(state, 'postFailed', [p('f1', 'failed'), p('f2', 'failed')], false);
	assert.deepEqual(r.emit, []);
	assert.equal(r.initialized, true);
	assert.deepEqual(r.state, { event: 'postFailed', seenIds: ['f1', 'f2'] });
});

test('remembered ids are capped', () => {
	const state = { event: 'postPublished', seenIds: ['a', 'b', 'c'] };
	const r = processPoll(state, 'postPublished', [p('e'), p('d')], false, 4);
	assert.deepEqual(r.state.seenIds, ['e', 'd', 'a', 'b']);
});

test('posts without an id are ignored', () => {
	const state = { event: 'postPublished', seenIds: [] };
	const r = processPoll(state, 'postPublished', [{ id: '', status: 'published' }, p('z')], false);
	assert.deepEqual(r.emit.map((x) => x.id), ['z']);
});
