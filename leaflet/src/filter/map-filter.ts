import { Map } from "leaflet";
import { compileExpression, FilterFunc } from "facilmap-utils";

declare module "leaflet" {
	interface Map {
		fmFilter: string | undefined;
		fmFilterFunc: FilterFunc;

		setFmFilter(filter?: string): void;
	}
}

Object.assign(Map.prototype, {
	fmFilter: undefined,
	fmFilterFunc: compileExpression(),

	setFmFilter(this: Map, filter?: string) {
		this.fmFilterFunc = compileExpression(filter);
		this.fmFilter = filter || undefined;
		this.fire("fmFilter");
	}
});
