import { viewValidator } from "./view.js";
import { formulaValidator, idValidator, mapSlugValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalCreate, onlyRead, onlyCreate, exceptCreate } from "./cru.js";
import { keys, numberRecordValidator, type DeepReadonly } from "./utility.js";

export const forbiddenCustomFunctionNames = Object.freeze([
	// Operators
	"and", "or", "not", "in", "of",

	// Built-in functions
	"abs", "ceil", "floor", "log", "max", "min", "random", "round", "sqrt",

	// Our custom functions
	"prop", "lower", "null",

	// Reserved JavaScript keywords
	"break", "case", "catch", "class", "const", "continue", "debugger", "default",
	"delete", "do", "else", "export", "extends", "false", "finally", "for",
	"function", "if", "import", "in", "instanceof", "new", "null", "return",
	"super", "switch", "this", "throw", "true", "try", "typeof", "var", "void",
	"while", "with", "yield", "let", "static", "enum", "await"
]);
export const customFunctionNameValidator = z.string()
	.min(1)
	.regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/, { message: "May only contain simple letters, numbers and underscores and must not start with a number." })
	.refine((val) => !forbiddenCustomFunctionNames.includes(val), { message: "This function name is not permitted." });

export const customFunctionValidator = z.object({
	name: z.string(),
	formula: formulaValidator
});
export type CustomFunction = z.infer<typeof customFunctionValidator>;


const noDuplicateCustomFunctionNames = (customFunctions: CustomFunction[], ctx: z.RefinementCtx) => {
	const names: Record<string, number> = {};
	for (const customFunction of customFunctions) {
		names[customFunction.name] = (names[customFunction.name] ?? 0) + 1;
	}

	for (let i = 0; i < customFunctions.length; i++) {
		if (names[customFunctions[i].name] > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Custom function names must be unique.",
				path: [i, "name"]
			});
		}
	}
};

export const routeFormulaValidator = z.object({
	name: z.string(),
	formula: formulaValidator
});
export type RouteFormula = z.infer<typeof routeFormulaValidator>;

const noDuplicateRouteFormulaNames = (routeFormulas: RouteFormula[], ctx: z.RefinementCtx) => {
	const names: Record<string, number> = {};
	for (const customFunction of routeFormulas) {
		names[customFunction.name] = (names[customFunction.name] ?? 0) + 1;
	}

	for (let i = 0; i < routeFormulas.length; i++) {
		if (names[routeFormulas[i].name] > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Route formula names must be unique.",
				path: [i, "name"]
			});
		}
	}
};


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
		if (p.admin) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["types"], message: "An admin link cannot have restricted access to types/fields." });
		}

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
	readToken: onlyRead(mapSlugValidator),
	comment: z.string(),
	password: {
		read: z.boolean(),
		create: z.literal(false).or(z.string()),
		update: z.boolean().or(z.string())
	},
	permissions: mapPermissionsValidator,
	searchEngines: z.boolean()
});
export type MapLink<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapLinkValidator>;

export const activeMapLinkValidator = mapLinkValidator.read.or(mapLinkValidator.read.omit({ id: true, readToken: true }).extend({
	id: z.undefined().optional(),
	readToken: z.undefined().optional()
}));
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
	customFunctions: optionalCreate(z.array(customFunctionValidator).superRefine(noDuplicateCustomFunctionNames), () => []),
	routeFormulas: optionalCreate(z.array(routeFormulaValidator).superRefine(noDuplicateRouteFormulaNames), () => []),
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

export function getMainAdminLinkCandidates<L extends DeepReadonly<{ permissions: MapPermissions }>>(mapLinks: ReadonlyArray<L>): L[] {
	return mapLinks.filter((l) => l.permissions.admin)!;
}

export function getMainAdminLink<L extends DeepReadonly<{ permissions: MapPermissions }>>(mapLinks: ReadonlyArray<L>): L {
	return mapLinks.find((l) => l.permissions.admin)!;
}

export const ADMIN_LINK_COMMENT = "Admin link";
export const WRITE_LINK_COMMENT = "Editable link";
export const READ_LINK_COMMENT = "Read-only link";