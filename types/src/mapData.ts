import { viewValidator } from "./view.js";
import { idValidator, mapSlugValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalCreate, onlyRead, onlyCreate, exceptCreate } from "./cru.js";
import { keys, numberRecordValidator } from "./utility.js";

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
	password: {
		read: z.boolean(),
		create: z.literal(false).or(z.string()),
		update: z.literal(false).or(z.string()).optional() // Undefined will keep existing password
	},
	permissions: mapPermissionsValidator
});
export type MapLink<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapLinkValidator>;

export const mapLinksValidator = {
	read: z.array(mapLinkValidator.read),
	create: z.array(mapLinkValidator.create).superRefine((links, ctx) => {
		if (!links.some((link) => link.permissions.admin)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "At least one map link must have admin permission."
			});
		}

		for (let i = 0; i < links.length; i++) {
			const link = links[i];
			if (links.some((l, j) => i !== j && link.slug === l.slug && (!link.password || link.password === l.password))) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Different map links can only share the same slug if they have different passwords.",
					path: [i, "slug"]
				});
			}
		}
	}),
	update: z.array(mapLinkValidator.update).superRefine((links, ctx) => {
		if (!links.some((link) => link.permissions.admin)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "At least one map link must have admin permission."
			});
		}

		// Cannot validate duplicate slugs here since we don't have access to all passwords.
		// Instead, we manually validate the links using the create validator in DatabaseMaps.
	})
};

export const mapDataValidator = cruValidator({
	id: onlyRead(idValidator),
	name: optionalCreate(z.string().max(100), ""),
	searchEngines: optionalCreate(z.boolean(), false),
	description: optionalCreate(z.string(), ""),
	clusterMarkers: optionalCreate(z.boolean(), false),
	legend1: optionalCreate(z.string(), ""),
	legend2: optionalCreate(z.string(), ""),
	defaultViewId: optionalCreate(idValidator.or(z.null()), null),
	links: {
		create: z.array(mapLinkValidator.create),
		read: z.array(mapLinkValidator.read),
		update: z.array(mapLinkValidator.update).optional()
	},
	activeLink: onlyRead(mapLinkValidator.read),

	createDefaultTypes: onlyCreate(z.boolean().default(true)),

	defaultView: onlyRead(viewValidator.read.or(z.null()))
});

export type MapData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapDataValidator>;