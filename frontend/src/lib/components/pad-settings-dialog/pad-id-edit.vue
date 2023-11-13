<script setup lang="ts">
	import { padIdValidator, type CRU, type PadData } from "facilmap-types";
	import { computed, ref } from "vue";
	import { getUniqueId, validateRequired } from "../../utils/utils";
	import copyToClipboard from "copy-to-clipboard";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";

	const idProps = ["id", "writeId", "adminId"] as const;
	type IdProp = typeof idProps[number];

	const context = injectContextRequired();

	const toasts = useToasts();

	const props = defineProps<{
		padData: PadData<CRU.CREATE>;
		idProp: IdProp;
		modelValue: string;
		label: string;
		description: string;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [string];
	}>();

	const id = getUniqueId("fm-pad-settings-pad-id-edit");

	const value = computed({
		get: () => props.modelValue,
		set: (val) => {
			emit("update:modelValue", val);
		}
	});

	const touched = ref(false);

	function validatePadId(id: string) {
		if (id) {
			const result = padIdValidator.safeParse(id);
			if (!result.success) {
				return result.error.format()._errors.join("\n");
			}
		}

		if (idProps.some((p) => p !== props.idProp && props.padData[p] === id)) {
			return "The same link cannot be used for different access levels.";
		}
	}

	function copy(text: string): void {
		copyToClipboard(text);
		toasts.showToast(undefined, "Map link copied", "The map link was copied to the clipboard.", { variant: "success", autoHide: true });
	}
</script>

<template>
	<ValidatedField
		class="row mb-3"
		:value="value"
		:validators="[validateRequired, validatePadId]"
	>
		<template #default="slotProps">
			<label :for="`${id}-input`" class="col-sm-3 col-form-label">{{props.label}}</label>
			<div class="col-sm-9 position-relative">
				<div class="input-group has-validation">
					<input
						:id="`${id}-input`"
						class="form-control fm-pad-settings-pad-id-edit"
						type="text"
						v-model="value"
						:ref="slotProps.inputRef"
						@input="touched = true"
						@blur="touched = true"
					/>
					<button
						class="btn btn-secondary"
						type="button"
						@click="copy(context.baseUrl + encodeURIComponent(padData[idProp]))"
					>Copy</button>
					<div class="invalid-tooltip">
						{{slotProps.validationError}}
					</div>
				</div>
				<div v-if="!slotProps.validationError" class="form-text">
					{{props.description}}
				</div>
			</div>
		</template>
	</ValidatedField>
</template>

<style lang="scss">
	.fm-pad-settings-pad-id-edit {
		input {
			min-width: 11rem;
		}
	}
</style>