<script setup lang="ts">
	import copyToClipboard from "copy-to-clipboard";
	import { computed, ref } from "vue";
	import { useToasts } from "./toasts/toasts.vue";
	import QrcodeVue from "qrcode.vue";
	import Popover from "./popover.vue";
	import Icon from "./icon.vue";
	import vTooltip from "../../utils/tooltip";
	import type { Validator } from "./validated-form/validated-field.vue";
	import ValidatedField from "./validated-form/validated-field.vue";
	import type { ThemeColour } from "../../utils/bootstrap";
	import { useI18n } from "../../utils/i18n";

	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		prefix?: string;
		noQr?: boolean;
		copyTooltip?: string;
		qrTooltip?: string;
		copiedTitle?: string;
		copiedMessage?: string;
		readonly?: boolean;
		rows?: number;
		/** If specified, will be used for the clipboard/QR code instead of `${prefix}${modelValue}` */
		fullUrl?: string;
		validators?: Array<Validator<string>>;
		variant?: ThemeColour;
	}>();

	const modelValue = defineModel<string>({ required: true });

	const qrButtonRef = ref<HTMLButtonElement>();
	const showQr = ref(false);

	const fullUrl = computed(() => props.fullUrl ?? `${props.prefix ?? ""}${modelValue.value}`);

	function copy(): void {
		copyToClipboard(fullUrl.value);
		toasts.showToast(undefined, () => (props.copiedTitle ?? i18n.t("copy-to-clipboard-input.copied-fallback-title")), () => (props.copiedMessage ?? i18n.t("copy-to-clipboard-input.copied-fallback-message")), { variant: "success", autoHide: true });
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
				<slot name="after1"></slot>
				<button
					type="button"
					:class="`btn btn-${props.variant ?? 'secondary'}`"
					@click="copy()"
					v-tooltip="props.copyTooltip ?? i18n.t('copy-to-clipboard-input.copy-fallback-tooltip')"
				>
					<Icon icon="copy" :alt="i18n.t('copy-to-clipboard-input.copy-alt')"></Icon>
				</button>
				<button
					v-if="!props.noQr"
					type="button"
					class="btn btn-secondary fm-copy-to-clipboard-input-qr-button"
					:class="{ active: showQr }"
					ref="qrButtonRef"
					@click="showQr = !showQr"
				>
					<Icon icon="qrcode" :alt="i18n.t('copy-to-clipboard-input.qr-code-alt')"></Icon>
					<span v-if="!showQr" class="fm-copy-to-clipboard-input-qr-tooltip" v-tooltip="props.qrTooltip ?? i18n.t('copy-to-clipboard-input.qr-code-fallback-tooltip')"></span>
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