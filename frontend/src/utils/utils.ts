import Vue from "vue";
import { isEqual } from "lodash";
import { clone, formatField, formatRouteMode, formatTime, round } from "facilmap-utils";
import { Field, Line, Marker, RouteMode, Type } from "facilmap-types";

/** Can be used as the "type" of props that accept an ID */
export const IdType = Number;

/**
 * Performs a 3-way merge. Takes the difference between oldObject and newObject and applies it to targetObject.
 * @param oldObject {Object}
 * @param newObject {Object}
 * @param targetObject {Object}
 */
export function mergeObject<T extends Record<keyof any, any>>(oldObject: T, newObject: T, targetObject: T): void {
	for(const i of new Set<keyof T & (number | string)>([...Object.keys(newObject), ...Object.keys(targetObject)])) {
		if(typeof newObject[i] == "object" && newObject[i] != null && targetObject[i] != null)
			mergeObject(oldObject && oldObject[i], newObject[i], targetObject[i]);
		else if(oldObject == null || !isEqual(oldObject[i], newObject[i]))
			Vue.set(targetObject, i, clone(newObject[i]));
	}
}

Vue.filter('round', (number: number, digits: number) => round(number, digits));

Vue.filter('fmFieldContent', (value: string, field: Field) => formatField(field, value));

Vue.filter('fmFormatTime', (value: number) => formatTime(value));

Vue.filter('fmRouteMode', (value: RouteMode) => formatRouteMode(value));

export function canControl(type: Type, what: keyof Marker | keyof Line, ignoreField?: Field): boolean {
	if((type as any)[what+"Fixed"] && ignoreField !== null)
		return false;

	const idx = "control"+what.charAt(0).toUpperCase() + what.slice(1);
	for (const field of type.fields) {
		if ((field as any)[idx] && (!ignoreField || field !== ignoreField))
			return false;
	}
	return true;
}