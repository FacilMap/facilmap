import { randomBytes, scrypt as scryptRaw, type BinaryLike, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { decode, sign, verify } from "jsonwebtoken";
import { idValidator, type ID, type MapPermissions } from "facilmap-types";
import { encodeBase64Url } from "./utils";
import { serializeMapPermissions } from "facilmap-utils";
import * as z from "zod";

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
	return sign({
		i: data.mapId,
		h: data.tokenHash,
		p: serializeMapPermissions(data.permissions)
	}, secret);
}

const mapTokenPayloadValidator = z.object({
	i: idValidator,
	h: z.string()
});

export function decodeMapTokenUnverified(token: string): Pick<MapTokenPayload, "mapId" | "tokenHash"> {
	const decoded = mapTokenPayloadValidator.parse(decode(token, { json: true }));
	return { mapId: decoded.i, tokenHash: decoded.h };
}

export function verifyMapToken(token: string, secret: Buffer): MapTokenPayload {
	return verify(token, secret) as any;
}

export async function getTokenHash(mapSlug: string, salt: Buffer, passwordHash: Buffer | null): Promise<string> {
	const pwd = `${mapSlug}${passwordHash ? `\n${encodeBase64Url(passwordHash)}` : ""}`;
	const hash = await scrypt(pwd.normalize(), salt, 12);
	return encodeBase64Url(hash);
}

export async function getPasswordHash(password: string, salt: Buffer): Promise<Buffer> {
	return await scrypt(password.normalize(), salt, 64);
}