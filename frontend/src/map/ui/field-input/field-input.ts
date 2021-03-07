import { Field } from "facilmap-types";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import WithRender from "./field-input.vue";

@WithRender
@Component({})
export default class FieldInput extends Vue {
	
	@Prop({ type: Object, required: true }) field!: Field;
	@Prop({ type: String }) value?: string;
	@Prop({ type: String }) id?: string;

	get effectiveValue(): string | undefined {
		return this.value ?? this.field.default;
	}

	set effectiveValue(value: string | undefined) {
		this.$emit("input", value);
	}

	get options(): Array<{ value: string; text: string }> {
		return this.field.options?.map((option) => ({
			value: option.value,
			text: option.value
		})) ?? [];
	}

}
