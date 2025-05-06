import type { CRU, MapData, MergedUnion } from "facilmap-types";
import { mergeArray, mergeObject } from "facilmap-utils";
import { omit } from "lodash-es";
import type { DeepReadonly } from "vue";

export function mergeMapData(oldObject: DeepReadonly<MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>>, newObject: DeepReadonly<MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>>, targetObject: MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>): void {
	mergeObject<Omit<typeof targetObject, "links">>(omit(oldObject, ["links"]), omit(newObject, ["links"]), targetObject);
	mergeArray(oldObject.links, newObject.links, targetObject.links, (f) => "id" in f ? f.id : undefined);
};