import { Map } from "leaflet";
import { compileExpression } from "facilmap-utils";

Object.assign(Map.prototype, {
	fmFilter: undefined,
	fmFilterFunc: compileExpression(),

	setFmFilter(this: Map, filter?: string) {
		this.fmFilterFunc = compileExpression(filter);
		this.fmFilter = filter || undefined;
		this.fire("fmFilter");
	}
});
