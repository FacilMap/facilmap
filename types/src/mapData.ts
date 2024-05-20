import { viewValidator } from "./view.js";
import { idValidator, mapSlugValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalUpdate, optionalCreate, onlyRead, onlyCreate } from "./cru.js";

export enum Writable {
	READ = 0,
	WRITE = 1,
	ADMIN = 2
}
export const writableValidator = z.nativeEnum(Writable);

export const mapDataValidator = cruValidator({
	id: optionalUpdate(mapSlugValidator),
	writeId: {
		read: mapSlugValidator,
		create: mapSlugValidator,
		update: mapSlugValidator.optional()
	},
	adminId: {
		read: mapSlugValidator,
		create: mapSlugValidator,
		update: mapSlugValidator.optional()
	},

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