export interface Config {
	openElevationApiUrl: string;
	nominatimUrl: string;
}

export let fetchAdapter = fetch;

export function setFetchAdapter(newFetchAdapter: typeof fetchAdapter): void {
	fetchAdapter = newFetchAdapter;
}

let config: Config | undefined;

export function getConfig(): Config {
	if (!config) {
		throw new Error("Config is not initialized.");
	}

	return config;
}

export function setConfig(newConfig: Config): void {
	config = newConfig;
}