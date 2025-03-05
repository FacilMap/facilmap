export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// https://stackoverflow.com/a/62085569/242365
export type DistributedKeyOf<T> = T extends any ? keyof T : never;
export type DistributedPick<T, K extends DistributedKeyOf<T>> = T extends any ? Pick<T, K> : never;
export type DistributedOmit<T, K extends DistributedKeyOf<T>> = T extends any ? Omit<T, K> : never;

export function isPromise(object: any): object is Promise<unknown> {
	return typeof object === 'object' && 'then' in object && typeof object.then === 'function';
}

/**
 * The config that the backend injects into the EJS template to be read by the frontend.
 */
export interface InjectedConfig {
	appName: string;
	openElevationApiUrl: string;
	openElevationThrottleMs: number;
	openElevationMaxBatchSize: number;
	nominatimUrl: string;
	limaLabsToken?: string;
	thunderforestToken?: string;
	tracestrackToken?: string;
	hideCommercialMapLinks?: boolean;
	supportsRoutes: boolean;
	supportsAdvancedRoutes: boolean;
}