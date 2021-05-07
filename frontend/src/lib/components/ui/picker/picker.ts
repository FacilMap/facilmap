import WithRender from "./picker.vue";
import "./picker.scss";
import Vue from "vue";
import { Component, Prop, Ref, Watch } from "vue-property-decorator";
import { getUniqueId } from "../../../utils/utils";
import { InjectContext } from "../../../utils/decorators";
import { Context } from "../../facilmap/facilmap";

@WithRender
@Component({ })
export default class Picker extends Vue {

	@InjectContext() context!: Context;

	@Prop({ type: String, default: () => getUniqueId("fm-picker") }) id!: string;
	@Prop({ type: String, default: "" }) customClass!: string;
	@Prop({ type: Boolean, default: false }) expand!: boolean;
	@Prop({ type: Boolean, default: false }) disabled!: boolean;
	@Prop({ type: Boolean }) state?: boolean | null;
	@Prop({ type: String }) value?: string;

	@Ref() container!: HTMLElement;
	@Ref() input!: HTMLInputElement;
	@Ref() modalInner!: HTMLElement;

	popoverOpen = false;
	modalOpen = false;
	uniqueClass = getUniqueId("fm-picker-unique");
	styleEl: HTMLElement | null = null;
	blurTimeout: ReturnType<typeof setTimeout> | null = null;
	isPopoverMouseDown = false;

	beforeDestroy(): void {
		document.body.removeEventListener("mousedown", this.handleBodyMouseDown, true);
		document.body.removeEventListener("keydown", this.handleBodyKeyDown);
		if (this.styleEl)
			this.styleEl.remove();
	}

	get open(): boolean {
		return this.popoverOpen || this.modalOpen;
	}

	set open(open: boolean) {
		if (open && !this.open) {
			if (this.context.isNarrow)
				this.modalOpen = true;
			else
				this.popoverOpen = true;
		} else if (!open) {
			this.modalOpen = false
			this.popoverOpen = false;
		}
	}

	@Watch("popoverOpen")
	handlePopoverOpenChange(popoverOpen: boolean): void {
		if (popoverOpen)
			document.body.addEventListener("mousedown", this.handleBodyMouseDown, true);
		else
			document.body.removeEventListener("mousedown", this.handleBodyMouseDown, true);
	}

	@Watch("open")
	handleOpenChange(modalOpen: boolean): void {
		if (modalOpen)
			document.body.addEventListener("keydown", this.handleBodyKeyDown);
		else
			document.body.removeEventListener("keydown", this.handleBodyKeyDown);
	}

	get body(): HTMLElement {
		return document.body;
	}

	handleInputClick(): void {
		this.open = true;
	}

	handleInputBlur(): void {
		if (this.popoverOpen && !this.isPopoverMouseDown) {
			this.blurTimeout = setTimeout(() => {
				this.popoverOpen = false;
			}, 0);
		}
	}

	handleBodyMouseDown(event: MouseEvent): void {
		if ((event.target as HTMLElement).closest(`#${this.id}-container,.${this.uniqueClass}`)) {
			this.isPopoverMouseDown = true;
			setTimeout(() => {
				this.isPopoverMouseDown = false;
			}, 0);

			if (this.blurTimeout) {
				clearTimeout(this.blurTimeout);
				this.blurTimeout = null;
			}
		} else if (this.popoverOpen)
			this.popoverOpen = false;
	}

	handleBodyKeyDown(event: KeyboardEvent): void {
		if (event.key == "Enter") {
			document.getElementById(this.id)!.focus();
			this.modalOpen = false;
			this.popoverOpen = false;
			event.preventDefault();
		} else if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
			this.$emit("keydown", event);
		} else if (event.key == "Escape" && this.popoverOpen) {
			this.popoverOpen = false;
			event.preventDefault();
			document.getElementById(this.id)!.focus();
		}
	}

	handleInputKeyDown(event: KeyboardEvent): void {
		if (["ArrowDown", "ArrowUp"].includes(event.key)) {
			if (!this.open) {
				this.open = true;
				event.preventDefault();
			} else
				this.$emit("keydown", event);
			event.stopPropagation(); // To not be picked up by handleBodyKeyDown()
		} else if (event.key == "Escape" && this.popoverOpen) {
			event.preventDefault();
			event.stopPropagation(); // Prevent closing outer modal
			this.popoverOpen = false;
		}
	}

	handlePopoverFocus(): void {
		if (this.blurTimeout) {
			clearTimeout(this.blurTimeout);
			this.blurTimeout = null;
		}
	}

	handleOpenPopover(): void {
		if (this.expand) {
			this.styleEl = document.createElement("style");
			this.styleEl.innerHTML = `.fm-picker-popover.${this.uniqueClass} { max-width: none; width: ${this.container.offsetWidth}px }`;
			document.querySelector("head")!.appendChild(this.styleEl);
		}
	}

	handleClosePopover(): void {
		this.styleEl?.remove();
		this.styleEl = null;
	}

	close(): void {
		this.open = false;
	}

}