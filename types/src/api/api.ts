import type { ApiV3 } from "./api-v3.js";

export enum ApiVersion {
	V3 = "v3"
}

export type Api<Version extends ApiVersion, Validated extends boolean = false> = (
	Version extends ApiVersion.V3 ? ApiV3<Validated> : never
);