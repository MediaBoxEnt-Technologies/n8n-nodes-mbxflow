// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
// Flat config, so ESLint never climbs to a config outside this package.
const tsParser = require('@typescript-eslint/parser');
const n8nNodesBase = require('eslint-plugin-n8n-nodes-base');

const plugins = { 'n8n-nodes-base': n8nNodesBase };

module.exports = [
	{
		ignores: ['node_modules/**', 'dist/**', '.test-build/**', 'test/**', 'scripts/**', 'eslint.config.js'],
	},
	{
		files: ['package.json'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { extraFileExtensions: ['.json'] },
		},
		plugins,
		rules: {
			...n8nNodesBase.configs.community.rules,
			'n8n-nodes-base/community-package-json-name-still-default': 'off',
		},
	},
	{
		files: ['credentials/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { project: ['./tsconfig.json'], sourceType: 'module' },
		},
		plugins,
		rules: {
			...n8nNodesBase.configs.credentials.rules,
			// Community credentials link to the vendor's own docs page, a full URL.
			'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
		},
	},
	{
		files: ['nodes/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { project: ['./tsconfig.json'], sourceType: 'module' },
		},
		plugins,
		rules: { ...n8nNodesBase.configs.nodes.rules },
	},
];
