export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

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
	hideCommercialMapLinks?: boolean;
	supportsRoutes: boolean;
	supportsAdvancedRoutes: boolean;
}