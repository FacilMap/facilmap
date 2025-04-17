import { viewValidator } from "./view.js";
import { idValidator, mapSlugValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalUpdate, optionalCreate, onlyRead, onlyCreate } from "./cru.js";
import { numberRecordValidator } from "./utility.js";

export enum Writable {
	READ = 0,
	WRITE = 1,
	ADMIN = 2
}
export const writableValidator = z.nativeEnum(Writable);

export const mapPermissionsValidator = cruValidator({
	edit: z.boolean(),
	settings: z.boolean(),
	admin: z.boolean(),
	types: numberRecordValidator(z.object({
		read: z.boolean(),
		update: z.boolean(),
		delete: z.boolean(),
		fields: z.record(z.object({
			read: z.boolean(),
			update: z.boolean()
		}))
	}))
});

export const mapLinkValidator = cruValidator({
	id: onlyRead(idValidator),
	mapId: onlyRead(idValidator),
	slug: mapSlugValidator,
	password: {
		read: z.boolean(),
		create: z.literal(false).or(z.string()),
		update: z.literal(false).or(z.string())
	},
	permissions: mapPermissionsValidator
});

export const mapDataValidator = cruValidator({
	id: onlyRead(idValidator),
	readId: optionalUpdate(mapSlugValidator),
	writeId: optionalUpdate(mapSlugValidator),
	adminId: optionalUpdate(mapSlugValidator),
	name: optionalCreate(z.string().max(100), ""),
	searchEngines: optionalCreate(z.boolean(), false),
	description: optionalCreate(z.string(), ""),
	clusterMarkers: optionalCreate(z.boolean(), false),
	legend1: optionalCreate(z.string(), ""),
	legend2: optionalCreate(z.string(), ""),
	defaultViewId: optionalCreate(idValidator.or(z.null()), null),

	createDefaultTypes: onlyCreate(z.boolean().default(true)),

	defaultView: onlyRead(viewValidator.read.or(z.null()))
});

export type MapData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapDataValidator>;
export type AdminMapData = MapData & Required<Pick<MapData, "writeId" | "adminId">>;

export type MapDataWithWritable = (
	| { writable: Writable.ADMIN } & MapData
	| { writable: Writable.WRITE } & Omit<MapData, "adminId">
	| { writable: Writable.READ } & Omit<MapData, "adminId" | "writeId">
);