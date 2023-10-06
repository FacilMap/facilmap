import { Config } from '@jest/types';

const config: Config.InitialOptions = {
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'node',
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		'^.+\\.m?[tj]sx?$': [
			'ts-jest',
			{
				useESM: true,
			},
		],
	},
};

export default config;
