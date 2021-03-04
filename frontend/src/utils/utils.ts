import Vue from "vue";
import { isEqual } from "lodash";
import { clone } from "facilmap-utils";

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
