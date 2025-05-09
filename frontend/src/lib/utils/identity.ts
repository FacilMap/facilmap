import { encodeBase64Url } from "facilmap-utils";
import storage from "./storage";
import { entries, keys, type ID, type MapSlug } from "facilmap-types";

export function createIdentity(): string {
	return encodeBase64Url(crypto.getRandomValues(new Uint8Array(12)));
}

export async function getStorageSlugHash(mapSlug: MapSlug): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${mapSlug.normalize()}${storage.salt}`));
	return encodeBase64Url(new Uint8Array(hash)).slice(0, 16);
}

export function getIdentityForMapSlugHash(mapSlugHash: string): ReadonlyArray<string> | undefined {
	const res = entries(storage.identities).find(([mapId, i]) => i.links.some((l) => l.slug === mapSlugHash));
	return res ? res[1].identities : undefined;
}

export function getIdentityForMapId(mapId: ID): ReadonlyArray<string> | undefined {
	return storage.identities[mapId]?.identities;
}

/**
 * Store/update the given identity for the given map in the storage. Also store a reference to the given map slug,
 * and delete any existing references to the map slug and map link ID that do not match the provided context.
 * @param force If true, add the identity if no identity is stored yet for the given map. If false, only update
 *     map link ID/slug references if the identity is not stored yet.
 */
export function storeIdentity(
	context: { mapId: ID; mapSlugHash: string; mapLinkId: ID | undefined },
	identities: ReadonlyArray<string>,
	force: boolean
): void {
	let linkExists = false;
	for (const mapId of keys(storage.identities)) {
		for (let i = 0; i < storage.identities[mapId].links.length; i++) {
			const link = storage.identities[mapId].links[i];
			if (link.slug === context.mapSlugHash || link.id === context.mapLinkId) {
				if (mapId === `${context.mapId}` && link.slug === context.mapSlugHash && link.id === context.mapLinkId) {
					linkExists = true;
				} else {
					storage.identities[mapId].links.splice(i--, 1);
				}
			}
		}

		// Keep identity even if no links are persisted anymore, in case the map is opened again with a new slug one day
	}

	if (storage.identities[context.mapId]) {
		storage.identities[context.mapId].identities = [...identities];
	} else if (force) {
		storage.identities[context.mapId] = { identities: [...identities], links: [] };
	} else {
		return;
	}

	if (!linkExists) {
		storage.identities[context.mapId].links.push({ id: context.mapLinkId, slug: context.mapSlugHash });
	}
}