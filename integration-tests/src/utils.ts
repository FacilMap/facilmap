import { io, Socket } from "socket.io-client";
import { SocketClient, SocketClientStorage } from "facilmap-client";
import ClientV3 from "facilmap-client-v3";
import ClientV4 from "facilmap-client-v4";
import { type CRU, type MapData, SocketVersion, type SocketClientToServerEvents, type SocketServerToClientEvents, type MapDataWithWritable, type DeepReadonly, type LegacyV2MapData, Writable } from "facilmap-types";
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

const clientConstructors = {
	[SocketVersion.V1]: ClientV3,
	[SocketVersion.V2]: ClientV4,
	[SocketVersion.V3]: SocketClient
};

const clientStorageConstructors = {
	[SocketVersion.V3]: SocketClientStorage
};

type ClientInstance<V extends SocketVersion> = InstanceType<typeof clientConstructors[V]> & { _version: V };

type ClientStorageInstance<V extends keyof typeof clientStorageConstructors> = InstanceType<typeof clientStorageConstructors[V]> & { _version: V };

export async function openClient<V extends SocketVersion.V3 = SocketVersion.V3>(version: V = SocketVersion.V3 as any): Promise<ClientInstance<V>> {
	const client = Object.assign(new clientConstructors[version](getFacilMapUrl(), { reconnection: false }) as any, { _version: version });
	await new Promise<void>((resolve, reject) => {
		client.on("connect", resolve);
		client.on("serverError", reject);
		client.on("connect_error", reject);
	});
	return client;
}

export async function openClientStorage<V extends SocketVersion.V3 = SocketVersion.V3>(mapSlug?: string, version: V = SocketVersion.V3 as any): Promise<ClientStorageInstance<V>> {
	const client = await openClient(version);
	const storage = Object.assign(new clientStorageConstructors[version](client), { _version: version }) as ClientStorageInstance<V>;
	if (mapSlug) {
		await client.subscribeToMap(mapSlug).subscribePromise;
	}
	return storage;
}

export async function openClientV2<V extends SocketVersion.V1 | SocketVersion.V2>(id: string | undefined, version: V): Promise<ClientInstance<V>> {
	const client = Object.assign(new clientConstructors[version](getFacilMapUrl(), id, { reconnection: false }) as any, { _version: version });
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
	storage: ClientStorageInstance<V>,
	data: D,
	callback?: (createMapData: ReturnType<typeof getTemporaryMapData<V, D>>, mapData: DeepReadonly<Extract<MapDataWithWritable, { writable: Writable.ADMIN }>>, subscription: SocketClientMapSubscription) => Promise<void>
): Promise<void> {
	const createMapData = getTemporaryMapData(storage._version, data);
	const subscription = await storage.client.createMapAndSubscribe(createMapData).subscribePromise;
	try {
		await callback?.(createMapData, storage.maps[subscription.mapSlug].mapData as Extract<MapDataWithWritable, { writable: Writable.ADMIN }>, subscription);
	} finally {
		await storage.client.deleteMap(createMapData.adminId);
	}
}

export async function createTemporaryMapV2<V extends SocketVersion.V1 | SocketVersion.V2, D extends Partial<LegacyV2MapData<CRU.CREATE>>>(
	client: ClientInstance<V>,
	data: D,
	callback?: (createMapData: ReturnType<typeof getTemporaryMapData<V, D>>, mapData: NonNullable<ClientInstance<V>["padData"]>, result: Awaited<ReturnType<ClientInstance<V>["createPad"]>>) => Promise<void>
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