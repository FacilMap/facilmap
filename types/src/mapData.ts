import { viewValidator } from "./view.js";
import { idValidator, mapSlugValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalCreate, onlyRead, onlyCreate, exceptCreate } from "./cru.js";
import { keys, numberRecordValidator, type DeepReadonly } from "./utility.js";

export const mapPermissionTypeValidator = z.boolean().or(z.enum(["own"]));
export type MapPermissionType = z.infer<typeof mapPermissionTypeValidator>;

function checkPermissionOrder<K extends string>(p: Record<K, boolean | "own">, order: K[], path: Array<string | number>, ctx: z.RefinementCtx): void {
	const stack = order.map((key) => ({ key, level: p[key] === true ? 2 : p[key] === "own" ? 1 : 0 }));
	for (let i = 0; i < stack.length - 1; i++) {
		if (stack.slice(i + 1).some((s) => s.level > stack[i].level)) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, stack[i].key], message: "Lower order permission level cannot be lower than higher order permission level." });
		}
	}
}

export const mapPermissionsValidator = z.object({
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
}).superRefine((p, ctx) => {
	checkPermissionOrder(p, ["read", "update", "settings", "admin"], [], ctx);

	if (p.types) {
		for (const type of keys(p.types)) {
			checkPermissionOrder(p.types[type], ["read", "update"], ["types", type], ctx);

			if (p.types[type].fields) {
				for (const field of keys(p.types[type].fields)) {
					checkPermissionOrder(p.types[type].fields[field], ["read", "update"], ["types", type, "fields", field], ctx);
				}
			}
		}
	}
});
export type MapPermissions = z.infer<typeof mapPermissionsValidator>;

export const mapLinkValidator = cruValidator({
	id: exceptCreate(idValidator),
	slug: mapSlugValidator,
	comment: z.string(),
	password: {
		read: z.boolean(),
		create: z.literal(false).or(z.string()),
		update: z.literal(false).or(z.string()).optional() // Undefined will keep existing password
	},
	permissions: mapPermissionsValidator,
	searchEngines: z.boolean()
});
export type MapLink<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapLinkValidator>;

export const activeMapLinkValidator = mapLinkValidator.read.omit({ id: true }).extend({
	id: mapLinkValidator.read.shape.id.optional()
});
export type ActiveMapLink = z.infer<typeof activeMapLinkValidator>;

export const mapLinksValidator = {
	read: z.array(mapLinkValidator.read),
	create: z.array(mapLinkValidator.create),
	update: z.array(mapLinkValidator.update.or(mapLinkValidator.create))
};

export const mapDataValidator = cruValidator({
	id: onlyRead(idValidator),
	name: optionalCreate(z.string().max(100), ""),
	description: optionalCreate(z.string(), ""),
	clusterMarkers: optionalCreate(z.boolean(), false),
	legend1: optionalCreate(z.string(), ""),
	legend2: optionalCreate(z.string(), ""),
	defaultViewId: optionalCreate(idValidator.or(z.null()), null),
	links: {
		create: mapLinksValidator.create,
		read: mapLinksValidator.read,
		update: mapLinksValidator.update.optional()
	},
	activeLink: onlyRead(activeMapLinkValidator),

	createDefaultTypes: onlyCreate(z.boolean().default(true)),

	defaultView: onlyRead(viewValidator.read.or(z.null()))
});

export type MapData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapDataValidator>;

export function getMainAdminLink<L extends DeepReadonly<{ permissions: MapPermissions }>>(mapLinks: ReadonlyArray<L>): L {
	return mapLinks.find((l) => l.permissions.admin)!;
}