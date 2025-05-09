import { idValidator, mapSlugValidator, renameProperty, stringifiedIdValidator } from "facilmap-types";
import { encodeBase64Url, overwriteObject } from "facilmap-utils";
import { isEqual, omit } from "lodash-es";
import { reactive, ref, toRaw, toRef, watch } from "vue";
import * as z from "zod";

function arrayIgnoringInvalids<T extends z.ZodTypeAny>(schema: T): z.ZodType<Array<z.output<T>>> {
	return z.array(z.any()).transform((arr): Array<z.output<T>> => {
		return arr.flatMap((v) => {
			const parsed = schema.safeParse(v);
			if (parsed.success) {
				return [parsed.data];
			} else {
				return [];
			}
		});
	});
}

export const favouriteValidator = z.record(z.any()).transform((val) => ({
	// Legacy 1: id: map slug (string), padId: read-only map slug of the map (string)
	// Legacy 2: id: map slug (string), mapId: read-only map slug of the map (string)
	// Now: mapId: map ID (number, undefined for transformed legacy favourite), mapSlug: map slug (string). read-only map slug is discarded
	...omit(val, ["padId", "id", "customName"]),
	mapId: typeof val.mapId === "number" ? val.mapId : undefined, // Used to be the read-only map slug
	mapSlug: val.mapSlug ?? val.id, // id is the legacy property name
	..."customName" in val && val.customName != null && val.customName !== "" ? { // Omit empty custom name
		customName: val.customName
	} : {}
})).pipe(z.object({
	/** ID used to open the map */
	mapSlug: mapSlugValidator,
	/** ID of the map */
	mapId: idValidator.optional(),
	/** ID of the map link */
	linkId: idValidator.optional(),
	/** Last known name of the map */
	name: z.string(),
	/** If this is defined, it is shown instead of the map name. */
	customName: z.string().optional()
}));

export type Favourite = z.infer<typeof favouriteValidator>;

export const customLinkValidator = z.object({
	label: z.string(),
	map: z.string(),
	marker: z.string()
});

export type CustomLink = z.infer<typeof customLinkValidator>;

const storageValidator2 = z.record(z.any()).transform((val) => renameProperty(val, "bookmarks", "favourites")).pipe(z.object({
	zoomToAll: z.boolean().catch(false),
	autoZoom: z.boolean().catch(true),
	favourites: arrayIgnoringInvalids(favouriteValidator).catch(() => []),
	baseLayer: z.string().optional(),
	overlays: z.array(z.string()).optional(),
	customLinks: z.array(customLinkValidator).optional(),
	presetLinks: z.record(z.object({
		enabled: z.boolean().optional(),
		idx: z.number().optional()
	})).optional(),
	salt: z.string().default(() => getStorageSalt()),
	identities: z.record(stringifiedIdValidator, z.object({
		links: z.array(z.object({
			id: idValidator.optional(),
			/**
			 * A hash of the map slug that the map was opened with. We need this because when we subscribe to the map,
			 * we need to pass the identity, but we don't know the map ID yet. By having the map slugs stored here, we
			 * can at least predict the identity for cases where the map has previously been opened with the same slug
			 * and where the slug has not changed.
			 * We store a hash rather than the slug itself to improve privacy: This way, an intruder who gets access
			 * to local storage can not find the map from it, and they can only prove that the user has used the map
			 * if they already have access to the map (and thus know its map ID).
			 */
			slug: z.string()
		})),
		identities: z.array(z.string())
	})).default(() => ({}))
}));
export const storageValidator = z.record(z.any()).catch(() => ({})).pipe(storageValidator2);

export interface Storage extends z.infer<typeof storageValidator2> {
}

/** When only these keys are updated, we don't need to request persistent storage. */
const NON_CRITICAL_KEYS: Array<keyof z.infer<typeof storageValidator2>> = ["zoomToAll", "autoZoom"];

const storage: Storage = reactive(storageValidator.parse({}));

export default storage;

function parseStorage(logErrors = false): Storage {
	try {
		let val = localStorage.getItem("facilmap");
		if (val) {
			val = JSON.parse(val);
		}

		return storageValidator.parse(val);
	} catch (err) {
		if (logErrors) {
			console.error("Error reading local storage", err);
		}
		return storageValidator.parse({});
	}
}

function load(): void {
	const val = parseStorage(true);
	overwriteObject(val, storage);
}

async function save() {
	try {
		const currentItem = parseStorage();

		if (!isEqual(currentItem, toRaw(storage))) {
			localStorage.setItem("facilmap", JSON.stringify(storage));

			if (!isEqual(omit(currentItem, NON_CRITICAL_KEYS), omit(toRaw(storage), NON_CRITICAL_KEYS)) && navigator.storage?.persist) {
				persisted.value = await navigator.storage.persist();
			}
		}
	} catch (err) {
		console.error("Error saving to local storage", err);
	}
}

load();
window.addEventListener("storage", load);

watch(() => storage, save, { deep: true });

const persisted = ref(false);
if (navigator.storage?.persisted) {
	navigator.storage.persisted().then((p) => {
		persisted.value = p;
	}).catch((err) => {
		console.warn("Error getting persisted storage.", err);
	});
}
export const storagePersisted = toRef(() => persisted.value);

function getStorageSalt(): string {
	return encodeBase64Url(crypto.getRandomValues(new Uint8Array(15)));
}