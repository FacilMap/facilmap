import { viewValidator } from "./view.js";
import { formulaValidator, idValidator, mapIdValidator } from "./base.js";
import * as z from "zod";
import { CRU, type CRUType, cruValidator, optionalUpdate, optionalCreate, onlyRead, onlyCreate } from "./cru.js";

export enum Writable {
	READ = 0,
	WRITE = 1,
	ADMIN = 2
}
export const writableValidator = z.nativeEnum(Writable);

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
	customFunctions: optionalCreate(z.array(customFunctionValidator).superRefine(noDuplicateCustomFunctionNames), () => []),
	routeFormulas: optionalCreate(z.array(routeFormulaValidator).superRefine(noDuplicateRouteFormulaNames), () => []),
	disableRte: optionalCreate(z.boolean(), false),

	createDefaultTypes: onlyCreate(z.boolean().default(true)),

	defaultView: onlyRead(viewValidator.read.or(z.null()))
});

export type MapData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof mapDataValidator>;
