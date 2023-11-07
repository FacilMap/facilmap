import { viewValidator } from "./view.js";
import { idValidator, padIdValidator } from "./base.js";
import * as z from "zod";
import { CRU, CRUType, cruValidator } from "./cru";

export enum Writable {
	READ = 0,
	WRITE = 1,
	ADMIN = 2
}
export const writableValidator = z.nativeEnum(Writable);

export const padDataValidator = cruValidator({
	allPartialUpdate: {
		id: padIdValidator,
		name: z.string(),
		searchEngines: z.boolean(),
		description: z.string(),
		clusterMarkers: z.boolean(),
		legend1: z.string(),
		legend2: z.string(),
		defaultViewId: idValidator.or(z.null())
	},
	onlyRead: {
		writable: writableValidator,
		defaultView: viewValidator.read.or(z.null())
	},
	exceptCreate: {
		writeId: padIdValidator.or(z.null()),
		adminId: padIdValidator.or(z.null())
	},
	onlyCreate: {
		writeId: padIdValidator,
		adminId: padIdValidator
	}
});

export type PadData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof padDataValidator>;
