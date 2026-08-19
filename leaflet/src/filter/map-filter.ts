import { Map } from "leaflet";
import { compileFilterExpression } from "facilmap-utils";
import type { CustomFunction, DeepReadonly } from "facilmap-types";
import { cloneDeep } from "lodash-es";

interface ExtendedMap extends Map {
	fmFilterCustomFuncs: DeepReadonly<CustomFunction[]>;
	updateFmFilter: () => void;
}

Object.assign(Map.prototype, {
	fmFilter: undefined,
	fmFilterFunc: compileFilterExpression(),
	fmFilterCustomFuncs: [],

	setFmFilter(this: ExtendedMap, filter?: string) {
		this.fmFilterFunc = compileFilterExpression(filter, this.fmFilterCustomFuncs);
		this.fmFilter = filter || undefined;
		this.fire("fmFilter");
	},

	setFmFilterCustomFuncs(this: ExtendedMap, customFuncs: DeepReadonly<CustomFunction[]>) {
		this.fmFilterCustomFuncs = cloneDeep(customFuncs);
		this.setFmFilter(this.fmFilter);
	}
});
