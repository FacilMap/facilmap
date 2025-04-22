import { randomBytes, scrypt as scryptRaw, type BinaryLike, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { sign, verify } from "jsonwebtoken";
import type { ID, MapPermissions } from "facilmap-types";
import { encodeBase64Url } from "./utils";

const scrypt = promisify(scryptRaw) as (password: BinaryLike, salt: BinaryLike, keylen: number, options?: ScryptOptions) => Promise<Buffer>;

export function createSalt(): Buffer {
	return randomBytes(8);
}

export function createJwtSecret(): Buffer {
	return randomBytes(32);
}

export type MapTokenPayload = {
	mapId: ID;
	tokenHash: string;
	permissions: MapPermissions;
};

export async function createMapToken(data: MapTokenPayload, secret: Buffer): Promise<string> {
	return sign(data, secret);
}

export function verifyMapToken(token: string, secret: Buffer): MapTokenPayload {
	return verify(token, secret);
}

export async function getTokenHash(mapSlug: string, salt: Buffer, password: string | null): Promise<string> {
	const pwd = `${mapSlug}${password ? `\n${password}` : ""}`;
	const hash = await scrypt(pwd.normalize(), salt, 12);
	return encodeBase64Url(hash);
}

export async function getPasswordHash(password: string, salt: Buffer): Promise<Buffer> {
	return await scrypt(password.normalize(), salt, 64);
}