import { mapIdValidator } from "facilmap-types";
import { overwriteObject } from "facilmap-utils";
import { isEqual } from "lodash-es";
import { reactive, watch } from "vue";
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

export const bookmarkValidator = z.record(z.any()).transform((val) => ({
	...val,
	mapId: val.mapId ?? val.padId // padId is the legacy property name
})).pipe(z.object({
	/** ID used to open the map */
	id: mapIdValidator,
	/** Read-only ID of the map */
	mapId: mapIdValidator,
	/** Last known name of the map */
	name: z.string(),
	/** If this is defined, it is shown instead of the map name. */
	customName: z.string().optional()
}));

export type Bookmark = z.infer<typeof bookmarkValidator>;

export const storageValidator = z.record(z.any()).catch(() => ({})).pipe(z.object({
	zoomToAll: z.boolean().catch(false),
	autoZoom: z.boolean().catch(true),
	bookmarks: arrayIgnoringInvalids(bookmarkValidator).catch(() => [])
}));

export interface Storage {
	zoomToAll: boolean;
	autoZoom: boolean;
	bookmarks: Bookmark[];
}

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

		if (!isEqual(currentItem, storage)) {
			localStorage.setItem("facilmap", JSON.stringify(storage));

			if (storage.bookmarks.length > 0 && !isEqual(currentItem.bookmarks, storage.bookmarks) && navigator.storage?.persist)
				await navigator.storage.persist();
		}
	} catch (err) {
		console.error("Error saving to local storage", err);
	}
}

load();
window.addEventListener("storage", load);

watch(() => storage, save, { deep: true });