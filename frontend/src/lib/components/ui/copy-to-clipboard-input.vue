<script setup lang="ts">
	import copyToClipboard from "copy-to-clipboard";
	import { computed, ref, type VNodeRef } from "vue";
	import { useToasts } from "./toasts/toasts.vue";
	import QrcodeVue from "qrcode.vue";
	import Popover from "./popover.vue";
	import Icon from "./icon.vue";
	import vTooltip from "../../utils/tooltip";
	import type { Validator } from "./validated-form/validated-field.vue";
	import ValidatedField from "./validated-form/validated-field.vue";

	const toasts = useToasts();

	const props = withDefaults(defineProps<{
		prefix?: string;
		noQr?: boolean;
		shortDescription?: string;
		longDescription?: string;
		readonly?: boolean;
		rows?: number;
		/** If specified, will be used for the clipboard/QR code instead of `${prefix}${modelValue}` */
		fullUrl?: string;
		validators?: Array<Validator<string>>;
	}>(), {
		shortDescription: "Link",
		longDescription: "The link"
	});

	const modelValue = defineModel<string>({ required: true });

	const emit = defineEmits<{
		hidden: [];
	}>();

	const qrButtonRef = ref<HTMLButtonElement>();
	const showQr = ref(false);

	const fullUrl = computed(() => props.fullUrl ?? `${props.prefix ?? ""}${modelValue.value}`);

	function copy(): void {
		copyToClipboard(fullUrl.value);
		toasts.showToast(undefined, `${props.shortDescription} copied`, `${props.longDescription} was copied to the clipboard.`, { variant: "success", autoHide: true });
	}
</script>

<template>
	<ValidatedField
		:value="modelValue"
		:validators="props.validators"
		v-bind="$attrs"
		class="fm-copy-to-clipboard-input"
	>
		<template #default="slotProps">
			<div class="input-group has-validation">
				<span v-if="props.prefix" class="input-group-text">{{props.prefix}}</span>
				<template v-if="props.rows && props.rows > 1">
					<textarea
						class="form-control"
						v-model="modelValue"
						:readonly="props.readonly"
						:rows="props.rows"
						:ref="slotProps.inputRef"
					></textarea>
				</template>
				<template v-else>
					<input
						class="form-control"
						v-model="modelValue"
						:readonly="props.readonly"
						:ref="slotProps.inputRef"
					/>
				</template>
				<button type="button" class="btn btn-secondary" @click="copy()">Copy</button>
				<button
					v-if="!props.noQr"
					type="button"
					class="btn btn-secondary fm-copy-to-clipboard-input-qr-button"
					:class="{ active: showQr }"
					ref="qrButtonRef"
					@click="showQr = !showQr"
				>
					<Icon icon="qrcode" alt="QR code"></Icon>
					<span v-if="!showQr" class="fm-copy-to-clipboard-input-qr-tooltip" v-tooltip="'Show QR code'"></span>
				</button>
				<div class="invalid-tooltip">
					{{slotProps.validationError}}
				</div>
			</div>
		</template>
	</ValidatedField>

	<Popover v-if="!props.noQr" :element="qrButtonRef" v-model:show="showQr" placement="left" hideOnOutsideClick>
		<QrcodeVue :value="fullUrl" :size="150" level="L" render-as="svg"></QrcodeVue>
	</Popover>
</template>

<style lang="scss">
	.fm-copy-to-clipboard-input {
		.fm-copy-to-clipboard-input-qr-button {
			position: relative;
		}

		.fm-copy-to-clipboard-input-qr-tooltip {
			position: absolute;
			inset: 0 0 0 0;
		}
	}
</style>