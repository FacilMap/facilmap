import { io, Socket } from "socket.io-client";
import Client from "facilmap-client";
import ClientV3 from "facilmap-client-v3";
import ClientV4 from "facilmap-client-v4";
import { type CRU, type PadData, SocketVersion, type SocketClientToServerEvents, type SocketServerToClientEvents } from "facilmap-types";
import { generateRandomPadId, sleep } from "facilmap-utils";


export function getFacilMapUrl(): string {
	if (!process.env.FACILMAP_URL) {
		throw new Error("Please specify the FacilMap server URL as FACILMAP_URL.");
	}
	return process.env.FACILMAP_URL;
}

export async function openSocket<V extends SocketVersion>(version: V): Promise<Socket<SocketServerToClientEvents<V>, SocketClientToServerEvents<V>>> {
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
	[SocketVersion.V3]: Client
};

type ClientInstance<V extends SocketVersion> = InstanceType<typeof clientConstructors[V]> & { _version: V };

export async function openClient<V extends SocketVersion = SocketVersion.V3>(id?: string, version: V = SocketVersion.V3 as any): Promise<ClientInstance<V>> {
	const client = Object.assign(new clientConstructors[version](getFacilMapUrl(), id, { reconnection: false }) as any, { _version: version });
	await new Promise<void>((resolve, reject) => {
		if (id != null) {
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

export function generateTestPadId(): string {
	return `integration-test-${generateRandomPadId()}`;
}

export function getTemporaryPadData<V extends SocketVersion, D extends Partial<Parameters<ClientInstance<V>["createPad"]>[0]>>(version: V, data: D): D & Pick<Parameters<ClientInstance<V>["createPad"]>[0], "id" | "writeId" | "adminId"> {
	return {
		id: generateTestPadId(),
		writeId: generateTestPadId(),
		adminId: generateTestPadId(),
		...data
	};
}

export async function createTemporaryPad<V extends SocketVersion, D extends Partial<PadData<CRU.CREATE>>>(
	client: ClientInstance<V>,
	data: D,
	callback?: (createPadData: ReturnType<typeof getTemporaryPadData<V, D>>, padData: NonNullable<ClientInstance<V>["padData"]>, result: Awaited<ReturnType<ClientInstance<V>["createPad"]>>) => Promise<void>
): Promise<void> {
	const createPadData = getTemporaryPadData(client._version, data);
	const result = await client.createPad(createPadData as any);
	try {
		await callback?.(createPadData, client.padData!, result as any);
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