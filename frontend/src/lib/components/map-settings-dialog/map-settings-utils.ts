import type { CRU, ID, MapData } from "facilmap-types";
import { mergeArray, mergeObject } from "facilmap-utils";
import { omit } from "lodash-es";
import type { DeepReadonly } from "vue";

export function mergeMapData(oldObject: DeepReadonly<MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>>, newObject: DeepReadonly<MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>>, targetObject: MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>): void {
	mergeObject<Omit<typeof targetObject, "links">>(omit(oldObject, ["links"]), omit(newObject, ["links"]), targetObject);
	mergeArray<Array<MapData<CRU.CREATE>["links"][number] | Required<MapData<CRU.UPDATE>>["links"][number]>, ID>(oldObject.links, newObject.links, targetObject.links, (f) => "id" in f ? f.id : undefined);
};