import WithRender from "./symbol-field.vue";
import Vue from "vue";
import "./symbol-field.scss";
import { getSymbolHtml, symbolList } from "facilmap-leaflet";
import { Component, Ref } from "vue-property-decorator";
import Icon from "../icon/icon";
import Picker from "../picker/picker";
import { extend } from "vee-validate";
import { arrowNavigation } from "../../../utils/ui";
import { keyBy, mapValues, pickBy } from "lodash";
import PrerenderedList from "../prerendered-list/prerendered-list";

extend("symbol", {
	validate: (symbol: string) => (symbol.length == 1 || symbolList.includes(symbol)),
	message: "Unknown icon"
});

const items = mapValues(keyBy(symbolList, (s) => s), (s) => getSymbolHtml("currentColor", "1.5em", s));

@WithRender
@Component({
	components: { Picker, PrerenderedList, Icon },
	props: {
		...(Picker as any).options.props
	}
})
export default class SymbolField extends Vue {

	@Ref() grid!: Vue;

	value!: string | undefined;
	filter = "";

	get items(): Record<string, string> {
		const result: Record<string, string> = {};

		if (this.filter.length == 1)
			result[this.filter] = getSymbolHtml("currentColor", "1.5em", this.filter);

		if (this.value?.length == 1 && this.value != this.filter)
			result[this.value] = getSymbolHtml("currentColor", "1.5em", this.filter);

		const lowerFilter = this.filter.trim().toLowerCase();
		Object.assign(result, pickBy(items, (val, key) => key.toLowerCase().includes(lowerFilter)));

		return result;
	}

	handleClick(symbol: Symbol, close: () => void): void {
		this.$emit("input", symbol);
		close();
	}

	handleKeyDown(event: KeyboardEvent): void {
		const newVal = arrowNavigation(Object.keys(this.items), this.value, this.grid.$el, event);
		if (newVal) {
			this.$emit('input', newVal);
			setTimeout(() => {
				this.grid.$el.querySelector<HTMLElement>(".active")?.focus();
			}, 0);
		}
	}

}