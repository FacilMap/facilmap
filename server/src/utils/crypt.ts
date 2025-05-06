import { createHash, randomBytes, scrypt as scryptRaw, type BinaryLike, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { sign, verify } from "jsonwebtoken";
import { type ID, type MapPermissions } from "facilmap-types";
import { base64ToNumber, base64UrlValidator, deserializeMapPermissions, encodeBase64Url, numberToBase64, serializeMapPermissions } from "facilmap-utils";
import { tupleWithOptional } from "zod-tuple-with-optional";

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

	const permissions = serializeMapPermissions(data.permissions);

	const jwt = sign({
		mapId: data.mapId,
		slugHash: data.slugHash,
		passwordHash: data.passwordHash,
		permissions
	}, secret, {
		noTimestamp: true
	}).split(".");

	return [
		jwt[2],
		numberToBase64(data.mapId),
		data.slugHash,
		permissions,
		...data.passwordHash != null ? [data.passwordHash] : []
	].join(".");
}

export function getMapIdFromMapTokenUnverified(token: string): ID {
	return base64ToNumber(base64UrlValidator.parse(token.split(".")[1]));
}

export function verifyMapToken(token: string, secret: Buffer): MapTokenPayload {
	const spl = tupleWithOptional([
		base64UrlValidator,
		base64UrlValidator,
		base64UrlValidator,
		base64UrlValidator,
		base64UrlValidator.optional()
	]).parse(token.split("."));

	const jwt = [
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
		encodeBase64Url(JSON.stringify({
			mapId: base64ToNumber(spl[1]),
			slugHash: spl[2],
			passwordHash: spl[4] ?? undefined,
			permissions: spl[3]
		})),
		spl[0]
	].join(".");

	const verified = verify(jwt, secret) as any;
	return {
		mapId: verified.mapId,
		slugHash: verified.slugHash,
		passwordHash: verified.passwordHash,
		permissions: deserializeMapPermissions(verified.permissions)
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
	return createHash("sha256").update(Buffer.concat([Buffer.from(identity.normalize()), salt])).digest();
}