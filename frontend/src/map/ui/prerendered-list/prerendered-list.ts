import WithRender from "./prerendered-list.vue";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import { mapValues } from "lodash";
import { quoteHtml } from "facilmap-utils";

@WithRender
@Component({})
export default class PrerenderedList extends Vue {

	@Prop({ type: String }) value?: string;
	@Prop({ type: Object, required: true }) items!: Record<string, string>;

	mounted(): void {
		this.handleValueChange();
	}

	get code(): string {
		return Object.values(mapValues(this.items, (val, key) => (`
			<li data-fm-item="${quoteHtml(key)}">
				<a href="javascript:" class="dropdown-item">
					${val}
				</a>
			</li>
		`))).join('');
	}

	@Watch("value")
	handleValueChange(): void {
		for (const el of this.$el.querySelectorAll(".active"))
			el.classList.remove("active");

		const active = this.value != null && [...this.$el.querySelectorAll<HTMLElement>("[data-fm-item]")].find((el) => el.getAttribute("data-fm-item") == this.value);
		if (active)
			active.querySelector("a")!.classList.add("active");
	}

	@Watch("items")
	handleItemsChange(): void {
		this.$nextTick(() => {
			this.handleValueChange();
		});
	}

	handleClick(e: MouseEvent): void {
		const item = (e.target as HTMLElement).closest("[data-fm-item]")?.getAttribute("data-fm-item");
		if (item)
			this.$emit("click", item);
	}

}