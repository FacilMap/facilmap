import WithRender from "./shape-field.vue";
import Vue from "vue";
import "./shape-field.scss";
import { getMarkerUrl, shapeList } from "facilmap-leaflet";
import { Component, Ref } from "vue-property-decorator";
import Icon from "../icon/icon";
import { quoteHtml } from "facilmap-utils";
import Picker from "../picker/picker";
import { Shape } from "facilmap-types";
import { extend } from "vee-validate";
import { arrowNavigation } from "../../../utils/ui";
import { keyBy, mapValues } from "lodash";
import PrerenderedList from "../prerendered-list/prerendered-list";

extend("shape", {
	validate: (shape: string) => shapeList.includes(shape as Shape),
	message: "Unknown shape"
});

const items = mapValues(keyBy(shapeList, (s) => s), (s) => `<img src="${quoteHtml(getMarkerUrl("#000000", 25, undefined, s))}">`);

@WithRender
@Component({
	components: { Picker, PrerenderedList, Icon },
	props: {
		...(Picker as any).options.props
	}
})
export default class ShapeField extends Vue {

	@Ref() grid!: Vue;

	value!: Shape | undefined;
	filter = "";
	items = items;

	get valueSrc(): string {
		return getMarkerUrl("#000000", 21, undefined, this.value);
	}

	handleClick(shape: Shape, close: () => void): void {
		this.$emit("input", shape);
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