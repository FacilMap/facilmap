import { io, Socket } from "socket.io-client";
import { RestClient, SocketClient, SocketClientStorage } from "facilmap-client";
import ClientV3 from "facilmap-client-v3";
import ClientV4 from "facilmap-client-v4";
import { type CRU, type MapData, SocketVersion, type SocketClientToServerEvents, type SocketServerToClientEvents, type MapDataWithWritable, type DeepReadonly, type LegacyV2MapData, Writable, ApiVersion } from "facilmap-types";
import { generateRandomMapSlug, sleep } from "facilmap-utils";
import type { SocketClientMapSubscription } from "facilmap-client/src/socket-client-map-subscription";

export function getFacilMapUrl(): string {
	if (!process.env.FACILMAP_URL) {
		throw new Error("Please specify the FacilMap server URL as FACILMAP_URL.");
	}
	return process.env.FACILMAP_URL;
}

export async function openSocket<V extends SocketVersion>(version: V): Promise<Socket<SocketServerToClientEvents<V>, SocketClientToServerEvents<V, false>>> {
	const serverUrl = new URL(getFacilMapUrl());
	const socket = io(`${serverUrl.origin}${version !== SocketVersion.V1 ? `/${version}` : ""}`, {
		forceNew: true,
		path: serverUrl.pathname.replace(/\/$/, "") + "/socket.io"
	});
	await new Promise<void>((resolve, reject) => {
		socket.on("connect", resolve);
		socket.on("connect_error", reject);
	});
	return socket;
}

const restClientConstructors = {
	[ApiVersion.V3]: RestClient
};

const socketClientConstructors = {
	[SocketVersion.V1]: ClientV3,
	[SocketVersion.V2]: ClientV4,
	[SocketVersion.V3]: SocketClient
};

const socketClientStorageConstructors = {
	[SocketVersion.V3]: SocketClientStorage
};

type RestClientInstance<V extends ApiVersion> = InstanceType<typeof restClientConstructors[V]> & { _version: V };

type SocketClientInstance<V extends SocketVersion> = InstanceType<typeof socketClientConstructors[V]> & { _version: V };

type SocketClientStorageInstance<V extends keyof typeof socketClientStorageConstructors> = InstanceType<typeof socketClientStorageConstructors[V]> & { _version: V };

export function getRestClient<V extends ApiVersion>(version: V): RestClientInstance<V> {
	return Object.assign(new restClientConstructors[version](getFacilMapUrl()) as any, { _version: version });
}

export async function openClient<V extends SocketVersion.V3 = SocketVersion.V3>(version: V): Promise<SocketClientInstance<V>> {
	const client = Object.assign(new socketClientConstructors[version](getFacilMapUrl(), { reconnection: false }) as any, { _version: version });
	await new Promise<void>((resolve, reject) => {
		client.on("connect", resolve);
		client.on("serverError", reject);
		client.on("connect_error", reject);
	});
	return client;
}

export async function openClientStorage<V extends SocketVersion.V3 = SocketVersion.V3>(mapSlug: string | undefined, version: V): Promise<SocketClientStorageInstance<V>> {
	const client = await openClient(version);
	const storage = Object.assign(new socketClientStorageConstructors[version](client), { _version: version }) as SocketClientStorageInstance<V>;
	if (mapSlug) {
		await client.subscribeToMap(mapSlug);
	}
	return storage;
}

export async function openClientV2<V extends SocketVersion.V1 | SocketVersion.V2>(id: string | undefined, version: V): Promise<SocketClientInstance<V>> {
	const client = Object.assign(new socketClientConstructors[version](getFacilMapUrl(), id, { reconnection: false }) as any, { _version: version });
	await new Promise<void>((resolve, reject) => {
		if (id != null) {
			client.on("mapData", () => {
				resolve();
			});
			client.on("padData", () => {
				resolve();
			});
		} else {
			client.on("connect", resolve);
		}
		client.on("serverError", reject);
		client.on("connect_error", reject);
	});
	return client;
}

export function generateTestMapSlug(): string {
	return `integration-test-${generateRandomMapSlug()}`;
}

export function getTemporaryMapData<V extends SocketVersion, D extends Partial<MapData<CRU.CREATE>>>(version: V, data: D): D & (V extends SocketVersion.V1 | SocketVersion.V2 ? Pick<LegacyV2MapData<CRU.CREATE>, "id" | "writeId" | "adminId"> : Pick<MapData<CRU.CREATE>, "readId" | "writeId" | "adminId">) {
	return {
		[[SocketVersion.V1, SocketVersion.V2].includes(version) ? "id" : "readId"]: generateTestMapSlug(),
		writeId: generateTestMapSlug(),
		adminId: generateTestMapSlug(),
		...data
	};
}

export async function createTemporaryMap<V extends SocketVersion.V3, D extends Partial<MapData<CRU.CREATE>>>(
	storage: SocketClientStorageInstance<V>,
	data: D,
	callback?: (createMapData: ReturnType<typeof getTemporaryMapData<V, D>>, mapData: DeepReadonly<Extract<MapDataWithWritable, { writable: Writable.ADMIN }>>, subscription: SocketClientMapSubscription) => Promise<void>
): Promise<void> {
	const createMapData = getTemporaryMapData(storage._version, data);
	const subscription = await storage.client.createMapAndSubscribe(createMapData);
	try {
		await callback?.(createMapData, storage.maps[subscription.mapSlug].mapData as Extract<MapDataWithWritable, { writable: Writable.ADMIN }>, subscription);
	} finally {
		await storage.client.deleteMap(createMapData.adminId);
	}
}

export async function createTemporaryMapV2<V extends SocketVersion.V1 | SocketVersion.V2, D extends Partial<LegacyV2MapData<CRU.CREATE>>>(
	client: SocketClientInstance<V>,
	data: D,
	callback?: (createMapData: ReturnType<typeof getTemporaryMapData<V, D>>, mapData: NonNullable<SocketClientInstance<V>["padData"]>, result: Awaited<ReturnType<SocketClientInstance<V>["createPad"]>>) => Promise<void>
): Promise<void> {
	const createMapData = getTemporaryMapData(client._version, data);
	const result = await client.createPad(createMapData as any);
	try {
		await callback?.(createMapData, client.padData!, result as any);
	} finally {
		await client.deletePad();
	}
}

export async function promiseCallback<T>(callback: (callback: T extends void ? (err: Error | null) => void : (err: Error | null, data: T) => void) => void): Promise<T> {
	return await new Promise<T>((resolve, reject) => {
		callback(((err: Error | null, data: T) => {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		}) as any);
	});
}

type EventArgs<Args extends any[]> = Args extends [...infer Others, (...args: any[]) => any] ? Others : Args;
type EventResult<Args extends any[]> = Args extends [...any[], (err: Error | null, data: infer Result) => any] ? Result : void;
export async function emit<EmitEvents extends Record<string, any>, Ev extends keyof EmitEvents>(socket: Socket<any, EmitEvents>, ev: Ev, ...args: EventArgs<Parameters<EmitEvents[Ev]>>): Promise<EventResult<Parameters<EmitEvents[Ev]>>> {
	return await promiseCallback((callback) => {
		// @ts-ignore
		socket.emit(ev, ...args, callback);
	});
}

export async function retry<R>(callback: () => R | Promise<R>): Promise<R> {
	// eslint-disable-next-line no-constant-condition
	for (let i = 0; true; i++) {
		try {
			return await callback();
		} catch (err: any) {
			if (i >= 100) {
				throw err;
			} else {
				await sleep(10);
			}
		}
	}
}