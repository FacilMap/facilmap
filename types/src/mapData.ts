import { viewValidator } from "./view.js";
import { idValidator, mapIdValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalUpdate, optionalCreate, onlyRead, onlyCreate } from "./cru.js";

export enum Writable {
	READ = 0,
	WRITE = 1,
	ADMIN = 2
}
export const writableValidator = z.nativeEnum(Writable);

export const mapDataValidator = cruValidator({
	id: optionalUpdate(mapIdValidator),
	writeId: {
		read: mapIdValidator.optional(), // Unavailable if map is opened in read-only mode
		create: mapIdValidator,
		update: mapIdValidator.optional()
	},
	adminId: {
		read: mapIdValidator.optional(), // Unavailable if map is opened in read-only/writeable mode
		create: mapIdValidator,
		update: mapIdValidator.optional()
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
