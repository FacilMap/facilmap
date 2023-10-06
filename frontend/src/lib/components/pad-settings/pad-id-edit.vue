<script setup lang="ts">
	import { PadDataCreate } from 'facilmap-types';
	import { Ref, computed, ref } from 'vue';
	import { getUniqueId } from '../../utils/utils';
	import copyToClipboard from 'copy-to-clipboard';
	import { showToast } from '../ui/toasts/toasts.vue';
	import { injectContextRequired } from '../../utils/context';

	const idProps = ["id", "writeId", "adminId"] as const;
	type IdProp = typeof idProps[number];

	const context = injectContextRequired();

	const props = defineProps<{
		padData: PadDataCreate;
		idProp: IdProp;
		label: string;
		description: string;
	}>();

	const id = getUniqueId("fm-pad-settings-pad-id-edit");

	const touched = ref(false);
	const error = computed(() => {
		const val = props.padData[props.idProp];
		if (!val) {
			return "Must not be empty.";
		} else if (val.includes("/")) {
			return "May not contain a slash.";
		} else if (idProps.some((p) => p !== props.idProp && props.padData[p] === props.padData[props.idProp])) {
			return "The same link cannot be used for different access levels.";
		}
	});

	function copy(text: string): void {
		copyToClipboard(text);
		showToast(undefined, "Map link copied", "The map link was copied to the clipboard.", { variant: "success" });
	}
</script>

<template>
	<div class="row mb-3" :class="{ 'was-validated': touched }">
		<label :for="`${id}-input`" class="col-sm-3 col-form-label">{{props.label}}</label>
		<div class="col-sm-9">
			<div class="input-group">
				<input
					:id="`${id}-input`"
					class="form-control fm-pad-settings-pad-id-edit"
					type="text"
					v-model="padData[idProp]"
					v-validity="error"
					@input="touched = true"
					@blur="touched = true"
				>
				<button
					class="btn btn-light"
					type="button"
					@click="copy(context.baseUrl + encodeURIComponent(padData[idProp]))"
				>Copy</button>
			</div>
			<div v-if="error" class="invalid-feedback">
				{{error}}
			</div>
			<div v-if="!error" class="form-text">
				{{props.description}}
			</div>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-pad-settings-pad-id-edit {
		input {
			min-width: 11rem;
		}
	}
</style>