<script setup lang="ts">
	import WithRender from "./width-field.vue";
	import Vue from "vue";
	import { BFormInput } from "bootstrap-vue";
	import { Component } from "vue-property-decorator";
	import { extend } from "vee-validate";

	extend("width", {
		validate: (width: any) => (!!`${width}`.match(/^[0-9]+$/) && Number(width) >= 1),
		message: "Width must be an integer and at least 1."
	});

	@WithRender
	@Component({
		props: {
			...(BFormInput as any).options.props
		}
	})
	export default class WidthField extends Vue {
	}
</script>

<template>
	<b-form-spinbutton min="1" v-bind="$props" v-on="$listeners"></b-form-spinbutton>
</template>

<style lang="scss">
</style>