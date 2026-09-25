// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
// Removes build output before a fresh build.
const fs = require('node:fs');
const path = require('node:path');

for (const dir of ['dist', '.test-build']) {
	fs.rmSync(path.resolve(__dirname, '..', dir), { recursive: true, force: true });
}
