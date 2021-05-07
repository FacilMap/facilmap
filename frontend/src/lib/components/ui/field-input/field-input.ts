import { Field } from "facilmap-types";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import WithRender from "./field-input.vue";
import "./field-input.scss";

@WithRender
@Component({})
export default class FieldInput extends Vue {

	@Prop({ type: Object, required: true }) field!: Field;
	@Prop({ type: Boolean, default: false }) ignoreDefault!: boolean;
	@Prop({ type: String }) value?: string;
	@Prop({ type: String }) id?: string;

	get effectiveValue(): string {
		return this.value ?? (this.ignoreDefault ? undefined : this.field.default) ?? '';
	}

	set effectiveValue(value: string) {
		this.$emit("input", value);
	}

	get options(): Array<{ value: string; text: string }> {
		return this.field.options?.map((option) => ({
			value: option.value,
			text: option.value
		})) ?? [];
	}

}
