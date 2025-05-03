import type { CRU, ID, Type } from "facilmap-types";
import { mergeArray, mergeObject } from "facilmap-utils";
import { omit } from "lodash-es";
import type { DeepReadonly } from "vue";

export function mergeTypeObject(oldObject: DeepReadonly<Type>, newObject: DeepReadonly<Type>, targetObject: Type<CRU.CREATE_VALIDATED | CRU.READ>): void {
	mergeObject<Omit<typeof targetObject, "fields">>(omit(oldObject, ["fields"]), omit(newObject, ["fields"]), targetObject);
	mergeArray<Array<Type<CRU.CREATE_VALIDATED>["fields"][number] | Type["fields"][number]>, ID>(oldObject.fields, newObject.fields, targetObject.fields, (f) => "id" in f ? f.id : undefined);
};