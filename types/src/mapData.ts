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

export const mapPermissionTypeValidator = z.boolean().or(z.enum(["own"]));
export type MapPermissionType = z.infer<typeof mapPermissionTypeValidator>;

export const mapPermissionsValidator = cruValidator({
	read: z.boolean().or(z.enum(["own"])),
	update: z.boolean().or(z.enum(["own"])),
	settings: z.boolean(),
	admin: z.boolean(),
	types: numberRecordValidator(z.object({
		read: z.boolean().or(z.enum(["own"])),
		update: z.boolean().or(z.enum(["own"])),
		fields: numberRecordValidator(z.object({
			read: z.boolean().or(z.enum(["own"])),
			update: z.boolean().or(z.enum(["own"]))
		})).optional()
	})).optional()
});
export type MapPermissions<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapPermissionsValidator>;

export const mapLinkValidator = cruValidator({
	id: onlyRead(idValidator),
	mapId: onlyRead(idValidator),
	slug: optionalUpdate(mapSlugValidator),
	readSlug: onlyRead(mapSlugValidator),
	password: {
		read: z.boolean(),
		create: z.literal(false).or(z.string()),
		update: z.literal(false).or(z.string()).optional()
	},
	permissions: {
		read: mapPermissionsValidator.read,
		create: mapPermissionsValidator.create,
		update: mapPermissionsValidator.update.optional()
	}
});
export type MapLink<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapLinkValidator>;

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