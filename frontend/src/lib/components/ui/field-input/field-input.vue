<script setup lang="ts">
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

</script>

<template>
	<div class="fm-field-input">
		<b-form-textarea v-if="field.type == 'textarea'" :id="id" v-model="effectiveValue"></b-form-textarea>
		<b-form-select v-else-if="field.type == 'dropdown'" :id="id" v-model="effectiveValue" :options="options"></b-form-select>
		<b-form-checkbox v-else-if="field.type == 'checkbox'" :id="id" v-model="effectiveValue" value="1" unchecked-value="0"></b-form-checkbox>
		<b-form-input v-else :id="id" v-model="effectiveValue"></b-form-input>
	</div>
</template>

<style lang="scss">
	.fm-field-input {

		.custom-checkbox {
			height: calc(1.5em + 0.75rem + 2px);
		}

		.custom-checkbox label::before, .custom-checkbox label::after {
			top: calc(0.75em - 0.125rem + 1px);
		}

	}
</style>