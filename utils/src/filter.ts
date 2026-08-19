import { compileExpression as filtrexCompileExpression } from "filtrex";
import { flattenObject, getProperty, quoteRegExp } from "./utils.js";
import { type ID, type Marker, type Line, type Type, type CRU, currentMarkerToLegacyV2, type DeepReadonly, type Formula, type Field, type Route, type CustomFunction } from "facilmap-types";
import { cloneDeep, omit } from "lodash-es";
import { normalizeFieldValue } from "./objects";
import { CHECKBOX_FALSE_LABEL, CHECKBOX_TRUE_LABEL } from "./format.js";

export type StrippedTypeForFormula = {
	type: Type["type"] | "route";
	fields: Array<Pick<Field, "id" | "name" | "type" | "formula">>;
};
export type FormulaFunc = (obj: DeepReadonly<Marker<CRU>> | DeepReadonly<Line<CRU>> | DeepReadonly<Omit<Route, "trackPoints">>, type: DeepReadonly<StrippedTypeForFormula>) => string;
export type FilterFunc = (...args: Parameters<FormulaFunc>) => boolean;

const customFuncs = {
	prop(obj: any, key: string) {
		return obj && getProperty(obj, key);
	},

	random() { }, // Does not work well with angular digest cycles

	lower(obj: any) {
		if (typeof obj == "string")
			return obj.toLowerCase();
		else
			return obj;
	},

	null(obj: any) {
		return obj == null;
	},

	log(...args: any) {
		if (typeof window !== "undefined") { // Only call in browser, not on the server
			console.log("Filter/formula debug output:", ...args);
		}
	}
};

/** The context object of the currently synchronously called filter function. */
let currentObject: any = undefined;

/** Keeps track synchronously of the called custom function names to prevent infinite recursion. */
let calledCustomFunctions: string[] = [];
export function makeCustomFunctions(customFunctions?: DeepReadonly<CustomFunction[]>): Record<string, Function> {
	const extraFunctions = {
		...Object.fromEntries((customFunctions ?? []).map((customFunction) => {
			let compiled = false;
			let compiledFunc;

			return [customFunction.name, (...args: any[]) => {
				if (!compiled) {
					compiledFunc = compileExpression(customFunction.formula, extraFunctions);
					compiled = true;
				}

				if (!compiledFunc!) {
					return;
				}

				const isOuter = calledCustomFunctions.length === 0;
				try {
					if (calledCustomFunctions.includes(customFunction.name)) {
						throw new Error(`Infinite recursion, tried to call function ${JSON.stringify(customFunction.name)} in function stack ${JSON.stringify(calledCustomFunctions)}.`);
					}
					calledCustomFunctions.push(customFunction.name);
					return compiledFunc({
						...currentObject,
						args
					});
				} finally {
					if (isOuter) {
						calledCustomFunctions = [];
					}
				}
			}];
		})),
		...customFuncs
	};
	return extraFunctions;
}

export function filterHasError(expr: string, customFunctions?: CustomFunction[]): Error | undefined {
	try {
		if(expr && expr.trim()) {
			filtrexCompileExpression(expr, {
				extraFunctions: {
					...Object.fromEntries(Object.entries(customFunctions ?? {}).map(([k, v]) => [k, () => undefined])),
					...customFuncs
				}
			});
		}
	} catch(e: any) {
		return e;
	}
}

export function validateFilter(filter: string): string | undefined {
	return filterHasError(filter)?.message;
}

function compileExpression(formula: Formula, extraFunctions: Record<string, Function>): ((obj: any) => any) | undefined {
	try {
		if (formula.type !== "filtrex") {
			throw new Error(`Formula type ${JSON.stringify(formula.type)} not supported.`);
		}

		if (formula.code.trim()) {
			return filtrexCompileExpression(formula.code, { extraFunctions });
		}
	} catch {
		// Ignore
	}
}

export function compileFilterExpression(expr?: string, customFunctions?: DeepReadonly<CustomFunction[]>): FilterFunc {
	const filterFunc = compileExpression({ type: "filtrex", code: expr ?? "" }, makeCustomFunctions(customFunctions));
	if (filterFunc) {
		return (obj, type) => {
			currentObject = prepareObject(obj, type, customFunctions);
			try {
				return !!filterFunc(currentObject);
			} finally {
				currentObject = undefined;
			}
		};
	} else {
		return () => true;
	}
}

export function compileFormulaExpression(formula?: Formula, customFunctions?: DeepReadonly<CustomFunction[]>): FormulaFunc {
	const compiled = formula && compileExpression(formula, makeCustomFunctions(customFunctions));
	if (compiled) {
		return (obj, type) => {
			currentObject = obj;
			try {
				const result = compiled(prepareObject(obj, type, customFunctions));
				switch (typeof result) {
					case "boolean":
						return result ? CHECKBOX_TRUE_LABEL : CHECKBOX_FALSE_LABEL;
					case "number":
					case "bigint":
						return typeof result === "number" && isNaN(result) ? "" : `${result}`;
					case "string":
						return result;
					default:
						return "";
				}
			} finally {
				currentObject = undefined;
			}
		};
	} else {
		return () => "";
	}
}

export function quote(str: string): string {
	return '"' + (""+str).replace(/["\\]/g, '\\$1').replace(/\n/g, "\\n") + '"';
}

export function _getMatchesWithBrackets(str: string, regexp: string): string[] {
	const ret: string[] = [ ];

	(str || "").replace(new RegExp(regexp, "gi"), (match, ...args) => {
		const offset = args[args.length-2];

		const open = match.match(/\(/g);
		const close = match.match(/\)/g);
		let needBraces = (open ? open.length : 0) - (close ? close.length : 0);
		let i = offset+match.length;
		for(; i<str.length && needBraces > 0; i++) {
			if(str[i] == "(")
				needBraces++;
			else if(str[i] == ")")
				needBraces--;
		}

		ret.push(str.substring(offset, i));

		return match;
	});

	return ret;
}

export function makeTypeFilter(previousFilter: string = "", typeId: ID, filteredData: boolean | Record<string, Record<string, boolean>>): string {
	function removePart(str: string, regexp: string[]) {
		str = str || "";
		for (const r of regexp) {
			str = str
				.replace(new RegExp("^" + r + "($|\\s+and\\s+|\\s+or\\s+)", "ig"), "")
				.replace(new RegExp("\\s+(and|or)\\s+" + r + "($|[^0-9a-z])", "ig"), (...args) => args[args.length-3])
		}
		return str;
	}

	let ret = removePart(previousFilter,
		_getMatchesWithBrackets(previousFilter, "(not\\s+)?\\(typeId\\s*==\\s*" + typeId).map(quoteRegExp)
			.concat([ "typeId\\s*[!=]=\\s*" + typeId ]));

	if(typeof filteredData == "boolean") {
		if(filteredData)
			ret = (ret ? ret + " and " : "") + "typeId!=" + typeId;
	} else {
		const append = [ ];
		for(const i in filteredData) {
			const no = Object.keys(filteredData[i]).filter(function(it) { return !filteredData[i][it]; });
			const yes = Object.keys(filteredData[i]).filter(function(it) { return filteredData[i][it]; });

			if(no.length == 0) // No item is not filtered, so we can filter the whole type
				return (ret ? ret + " and " : "") + "typeId!=" + typeId;

			if(yes.length > 0) {
				const negative = "prop(data," + quote(i) + ")" + (no.length > 1 ? " not in (" + no.map(quote).join(",") + ")" : "!=" + quote(no[0]));
				const positive = "prop(data," + quote(i) + ")" + (yes.length > 1 ? " in (" + yes.map(quote).join(",") + ")" : "==" + quote(yes[0]));

				append.push(negative.length < positive.length ? negative : positive);
			}
		}

		if(append.length > 0)
			ret = (ret ? ret + " and " : "") + "not (typeId=="+typeId+" and " + (append.length > 1 ? "(" + append.join(" or ") + ")" : append[0]) + ")";
	}

	return ret;
}

/**
 * Keeps track synchronously of the calculated formula field names to prevent infinite recursion.
 * When a filter/formula function accesses the value of a formula field, its result is calculated on the fly by its getter.
 * The formula field itself might access the value of another formula field again, which has the risk of creating an infinite loop.
 * This variable is normally undefined. When a getter encounters the variable as undefined, it knows that it is the "outermost"
 * getter and initializes the array. Each getter inserts its field name into the array, and if it finds its field name already there,
 * it returns an empty value, since we have an inifinite loop of field references. Since formula fields are calculated synchronously,
 * no more complex logic than tracking field names in this single global variable is necessary.
 */
let handledFieldNames: string[] | undefined = undefined;

export function prepareObject(obj: DeepReadonly<Marker<CRU>> | DeepReadonly<Line<CRU>> | Route, type: DeepReadonly<StrippedTypeForFormula>, customFunctions?: DeepReadonly<CustomFunction[]>): any {
	const fixedObj: any = cloneDeep(omit(obj, ["data"]));

	fixedObj.data = Object.create(null) as {};
	for (const field of type.fields) {
		if (field.type !== "formula") {
			fixedObj.data[field.id] = normalizeFieldValue(field, "data" in obj ? obj.data?.[field.id] : undefined);
		}
	}

	let ret = {
		...flattenObject(fixedObj),
		...fixedObj
	};

	// Backwards compatibility for filter expressions that were created before "symbol" was renamed to "icon" (keep old and new properties)
	ret = currentMarkerToLegacyV2(ret, undefined, undefined as any, true);

	if(type)
		ret.type = type.type;

	for (const field of type.fields) {
		if (field.type === "formula") {
			let value: [false] | [true, string] = [false];
			const getter = () => {
				if (!value[0]) {
					const isOuterGetter = (handledFieldNames == null);
					if (isOuterGetter) {
						handledFieldNames = [];
					}

					try {
						if (handledFieldNames!.includes(field.name)) {
							// Infinite loop, return empty value.
							value = [true, ""];
						} else {
							handledFieldNames!.push(field.name);
							value = [true, compileFormulaExpression(field.formula, customFunctions)(fixedObj, type)];
						}
					} finally {
						if (isOuterGetter) {
							handledFieldNames = undefined;
						}
					}
				}
				return value[1];
			};

			Object.defineProperty(fixedObj.data, field.name, { get: getter, enumerable: true });
			Object.defineProperty(fixedObj, `data.${field.name}`, { get: getter, enumerable: true });
		}
	}

	return ret;
}