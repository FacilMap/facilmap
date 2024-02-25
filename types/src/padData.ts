import { viewValidator } from "./view.js";
import { idValidator, padIdValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalUpdate, optionalCreate, onlyRead } from "./cru";

export enum Writable {
	READ = 0,
	WRITE = 1,
	ADMIN = 2
}
export const writableValidator = z.nativeEnum(Writable);

export const padDataValidator = cruValidator({
	id: optionalUpdate(padIdValidator),
	writeId: {
		read: padIdValidator.optional(), // Unavailable if pad is opened in read-only mode
		create: padIdValidator,
		update: padIdValidator.optional()
	},
	adminId: {
		read: padIdValidator.optional(), // Unavailable if pad is opened in read-only/writeable mode
		create: padIdValidator,
		update: padIdValidator.optional()
	},

	name: optionalCreate(z.string().max(100), ""),
	searchEngines: optionalCreate(z.boolean(), false),
	description: optionalCreate(z.string(), ""),
	clusterMarkers: optionalCreate(z.boolean(), false),
	legend1: optionalCreate(z.string(), ""),
	legend2: optionalCreate(z.string(), ""),
	defaultViewId: optionalCreate(idValidator.or(z.null()), null),

	defaultView: onlyRead(viewValidator.read.or(z.null()))
});

export type PadData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof padDataValidator>;
