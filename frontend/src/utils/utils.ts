import Vue from "vue";
import { isEqual } from "lodash";
import { clone } from "facilmap-utils";
import { Field, Line, Marker, Type } from "facilmap-types";

/** Can be used as the "type" of props that accept an ID */
export const IdType = Number;

/**
 * Performs a 3-way merge. Takes the difference between oldObject and newObject and applies it to targetObject.
 * @param oldObject {Object}
 * @param newObject {Object}
 * @param targetObject {Object}
 */
export function mergeObject<T extends Record<keyof any, any>>(oldObject: T | undefined, newObject: T, targetObject: T): void {
	for(const i of new Set<keyof T & (number | string)>([...Object.keys(newObject), ...Object.keys(targetObject)])) {
		if(
			Object.prototype.hasOwnProperty.call(newObject, i) && typeof newObject[i] == "object" && newObject[i] != null
			&& Object.prototype.hasOwnProperty.call(targetObject, i) && typeof targetObject[i] == "object" && targetObject[i] != null
		)
			mergeObject(oldObject && oldObject[i], newObject[i], targetObject[i]);
		else if(oldObject == null || !isEqual(oldObject[i], newObject[i]))
			Vue.set(targetObject, i, clone(newObject[i]));
	}
}

export function canControl<T extends Marker | Line = Marker | Line>(type: Type, ignoreField?: Field | null): Array<keyof T> {
	const props: string[] = type.type == "marker" ? ["colour", "size", "symbol", "shape"] : type.type == "line" ? ["colour", "width", "mode"] : [];
	return props.filter((prop) => {
		if((type as any)[prop+"Fixed"] && ignoreField !== null)
			return false;

		const idx = "control"+prop.charAt(0).toUpperCase() + prop.slice(1);
		for (const field of type.fields) {
			if ((field as any)[idx] && (!ignoreField || field !== ignoreField))
				return false;
		}
		return true;
	}) as Array<keyof T>;
}


let idCounter = 1;

export function getUniqueId(scope = ""): string {
	return `${scope ? `${scope}-` : ""}${idCounter++}`;
}