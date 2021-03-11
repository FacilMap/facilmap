import WithRender from "./symbol-field.vue";
import Vue from "vue";
import { BFormInput } from "bootstrap-vue";
import "./symbol-field.scss";
import { getSymbolHtml, symbolList } from "facilmap-leaflet";
import { Component, Prop, Ref } from "vue-property-decorator";
import Icon from "../icon/icon";
import { quoteHtml } from "facilmap-utils";
import FieldPopover from "../field-popover/field-popover";
import { extend } from "vee-validate";
import { getUniqueId } from "../../../utils/utils";

extend("symbol", {
	validate: (symbol: string) => (symbol.length == 1 || symbolList.includes(symbol)),
	message: "Unknown icon"
});

@WithRender
@Component({
	components: { FieldPopover, Icon },
	props: {
		...(BFormInput as any).options.props
	}
})
export default class SymbolField extends Vue {

	@Prop({ type: Boolean, default: false }) raised!: boolean;

	id?: string;
	value!: string | undefined;
	filter = "";
	popoverOpen = false;

	get effId(): string {
		return this.id ?? getUniqueId("fm-symbol-field");
	}

	get filteredSymbols(): string[] {
		const lowerFilter = this.filter.trim().toLowerCase();
		const list = lowerFilter == "" ? [...symbolList] : symbolList.filter((symbol) => symbol.toLowerCase().includes(lowerFilter));
		if (this.filter.length == 1)
			list.unshift(this.filter);
		if (this.value?.length == 1 && this.value != this.filter)
			list.unshift(this.value);
		return list;
	}

	get symbolsCode(): string {
		return this.filteredSymbols.map((symbol) => (`
			<li>
				<a href="javascript:" data-fm-symbol="${quoteHtml(symbol)}" class="dropdown-item${symbol === this.value ? ' active' : ''}">
					${getSymbolHtml("currentColor", "1.5em", symbol)}
				</a>
			</li>
		`)).join('');
	}

	handleClick(e: MouseEvent): void {
		const symbol = (e.target as HTMLElement).closest("[data-fm-symbol]")?.getAttribute("data-fm-symbol");
		if (symbol)
			this.$emit("input", symbol);
	}

	handleEscape(event: KeyboardEvent): void {
		if (this.popoverOpen) {
			event.preventDefault();
			event.stopPropagation(); // Prevent closing modal
			this.popoverOpen = false;
			document.getElementById(this.effId)!.focus();
		}
	}

}