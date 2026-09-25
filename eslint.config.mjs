// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
import { config } from '@n8n/node-cli/eslint';

export default [...config, { ignores: ['test/**', 'scripts/**', '.test-build/**'] }];
