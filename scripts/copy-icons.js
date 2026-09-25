// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
// Copies the SVG icons and codex JSON files next to the compiled nodes.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
for (const dir of ['credentials', 'nodes']) {
	walk(path.join(root, dir));
}

function walk(folder) {
	for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
		const full = path.join(folder, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (/\.(svg|png|json)$/i.test(entry.name)) {
			const target = path.join(root, 'dist', path.relative(root, full));
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.copyFileSync(full, target);
		}
	}
}
