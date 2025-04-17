import type { CRU, Type } from "facilmap-types";
import { mergeArray, mergeObject } from "facilmap-utils";
import { omit } from "lodash-es";
import type { DeepReadonly } from "vue";

export function mergeTypeObject(oldObject: DeepReadonly<Type>, newObject: DeepReadonly<Type>, targetObject: Type<CRU.CREATE_VALIDATED | CRU.READ>): void {
	mergeObject<Omit<typeof targetObject, "fields">>(omit(oldObject, ["fields"]), omit(newObject, ["fields"]), targetObject);
	mergeArray(oldObject.fields, newObject.fields, targetObject.fields, (f) => f.id);
};