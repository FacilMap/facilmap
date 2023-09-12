<script setup lang="ts">
	import WithRender from "./size-field.vue";
	import Vue from "vue";
	import { BFormInput } from "bootstrap-vue";
	import { Component } from "vue-property-decorator";
	import { extend } from "vee-validate";

	extend("size", {
		validate: (size: any) => (!!`${size}`.match(/^[0-9]+$/) && Number(size) >= 1),
		message: "Size must be an integer and at least 15."
	});

	@WithRender
	@Component({
		props: {
			...(BFormInput as any).options.props
		}
	})
	export default class SizeField extends Vue {
	}
</script>

<template>
	<b-form-spinbutton min="15" v-bind="$props" v-on="$listeners"></b-form-spinbutton>
</template>

<style lang="scss">
</style>