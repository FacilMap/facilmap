import { createHash, randomBytes, scrypt as scryptRaw, type BinaryLike, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { decode, sign, verify } from "jsonwebtoken";
import { idValidator, type ID, type MapPermissions } from "facilmap-types";
import { encodeBase64Url } from "./utils";
import { deserializeMapPermissions, serializeMapPermissions } from "facilmap-utils";
import * as z from "zod";

const scrypt = promisify(scryptRaw) as (password: BinaryLike, salt: BinaryLike, keylen: number, options?: ScryptOptions) => Promise<Buffer>;

export function createSalt(): Buffer {
	return randomBytes(20);
}

export function createJwtSecret(): Buffer {
	return randomBytes(32);
}

export type MapTokenPayload = {
	mapId: ID;
	slugHash: string;
	/** If specified, the token can be used without providing the map link password. */
	passwordHash?: string;
	permissions: MapPermissions;
};

export async function createMapToken(data: MapTokenPayload, secret: Buffer): Promise<string> {
	if (data.permissions.admin) {
		throw Object.assign(new Error("api.admin-token-error"), { status: 400 });
	}

	return sign({
		i: data.mapId,
		s: data.slugHash,
		h: data.passwordHash,
		p: serializeMapPermissions(data.permissions)
	}, secret);
}

export function getMapIdFromMapTokenUnverified(token: string): ID {
	const decoded = z.object({ i: idValidator }).parse(decode(token, { json: true }));
	return decoded.i;
}

export function verifyMapToken(token: string, secret: Buffer): MapTokenPayload {
	const verified = verify(token, secret) as any;
	return {
		mapId: verified.i,
		slugHash: verified.s,
		passwordHash: verified.h,
		permissions: deserializeMapPermissions(verified.p)
	};
}

export function getSlugHash(mapSlug: string, salt: Buffer): string {
	return encodeBase64Url(createHash("sha256").update(Buffer.concat([Buffer.from(mapSlug.normalize()), salt])).digest()).slice(0, 16);
}

export function getPasswordHashHash(passwordHash: Buffer, salt: Buffer): string {
	return encodeBase64Url(createHash("sha256").update(Buffer.concat([passwordHash, salt])).digest()).slice(0, 16);
}

export async function getPasswordHash(password: string, salt: Buffer): Promise<Buffer> {
	return await scrypt(password.normalize(), salt, 64);
}

export function getIdentityHash(identity: string, salt: Buffer): Buffer {
	return createHash("sha256").update(`${identity}${salt}`).digest();
}