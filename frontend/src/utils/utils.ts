import Vue from "vue";
import { isEqual } from "lodash";
import { clone } from "facilmap-utils";
import { Field, Line, Marker, SearchResult, Type } from "facilmap-types";

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
		if(typeof newObject[i] == "object" && newObject[i] != null && targetObject[i] != null)
			mergeObject(oldObject && oldObject[i], newObject[i], targetObject[i]);
		else if(oldObject == null || !isEqual(oldObject[i], newObject[i]))
			Vue.set(targetObject, i, clone(newObject[i]));
	}
}

export function canControl(type: Type, what: keyof Marker | keyof Line, ignoreField?: Field): boolean {
	if((type as any)[what+"Fixed"] && ignoreField != null)
		return false;

	const idx = "control"+what.charAt(0).toUpperCase() + what.slice(1);
	for (const field of type.fields) {
		if ((field as any)[idx] && (!ignoreField || field !== ignoreField))
			return false;
	}
	return true;
}


let idCounter = 1;

export function getUniqueId(scope = ""): string {
	return `${scope ? `${scope}-` : ""}${idCounter++}`;
}