import { io, Socket } from "socket.io-client";
import Client from "facilmap-client";
import { type CRU, type PadData, SocketVersion, type SocketClientToServerEvents, type SocketServerToClientEvents, Writable, type MultipleEvents, type SocketEvents } from "facilmap-types";
import { generateRandomPadId, sleep } from "facilmap-utils";

export function getFacilMapUrl(): string {
	if (!process.env.FACILMAP_URL) {
		throw new Error("Please specify the FacilMap server URL as FACILMAP_URL.");
	}
	return process.env.FACILMAP_URL;
}

export async function openSocket<V extends SocketVersion>(version: V): Promise<Socket<SocketServerToClientEvents<V>, SocketClientToServerEvents<V>>> {
	const serverUrl = new URL(getFacilMapUrl());
	const socket = io(`${serverUrl.origin}${version !== SocketVersion.V1 ? `/${SocketVersion}` : ""}`, {
		forceNew: true,
		path: serverUrl.pathname.replace(/\/$/, "") + "/socket.io"
	});
	await new Promise<void>((resolve, reject) => {
		socket.on("connect", resolve);
		socket.on("connect_error", reject);
	});
	return socket;
}

export async function openClient(id?: string): Promise<Client> {
	const client = new Client(getFacilMapUrl(), id, { reconnection: false });
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

export function getTemporaryPadData<D extends Partial<PadData<CRU.CREATE>>>(data: D): D & Pick<PadData<CRU.CREATE>, "id" | "writeId" | "adminId"> {
	return {
		id: generateTestPadId(),
		writeId: generateTestPadId(),
		adminId: generateTestPadId(),
		...data
	};
}

export async function createTemporaryPad<D extends Partial<PadData<CRU.CREATE>>>(
	client: Client,
	data: D,
	callback?: (createPadData: ReturnType<typeof getTemporaryPadData<D>>, padData: PadData & { writable: Writable }, result: MultipleEvents<SocketEvents<SocketVersion.V2>>) => Promise<void>
): Promise<void> {
	const createPadData = getTemporaryPadData(data);
	const result = await client.createPad(createPadData);
	try {
		await callback?.(createPadData, result.padData![0], result);
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
			if (i >= 10) {
				throw err;
			} else {
				await sleep(10);
			}
		}
	}
}