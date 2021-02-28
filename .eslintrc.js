module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:import/errors',
		'plugin:import/warnings',
		'plugin:import/typescript'
	],
	env: {
		node: true
	},
	rules: {
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/no-non-null-assertion": "off",
		"@typescript-eslint/ban-types": "off",
		"@typescript-eslint/explicit-module-boundary-types": ["warn", { allowArgumentsExplicitlyTypedAsAny: true }],
		"@typescript-eslint/triple-slash-reference": "off",
		"no-cond-assign": "off",
		"@typescript-eslint/no-empty-function": "off",
		"import/no-extraneous-dependencies": "error",
		"@typescript-eslint/no-empty-interface": "off",
		"@typescript-eslint/no-unused-vars": ["warn", { "args": "none" }],
		"@typescript-eslint/no-inferrable-types": "off",
		"import/no-unresolved": ["error", { "ignore": ["geojson" ] }],
		"import/export": "off"
	}
};