module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
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
		"@typescript-eslint/no-empty-function": "off"
	}
};