import { Map } from "leaflet";
import { compileFilterExpression } from "facilmap-utils";

Object.assign(Map.prototype, {
	fmFilter: undefined,
	fmFilterFunc: compileFilterExpression(),

	setFmFilter(this: Map, filter?: string) {
		this.fmFilterFunc = compileFilterExpression(filter);
		this.fmFilter = filter || undefined;
		this.fire("fmFilter");
	}
});
