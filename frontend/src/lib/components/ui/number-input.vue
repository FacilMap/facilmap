<script setup lang="ts">
	import type { Validator } from "./validated-form/validated-field.vue";
	import ValidatedField from "./validated-form/validated-field.vue";
	import { useValidatedModel } from "../../utils/vue";
	import { computed } from "vue";
	import { useI18n } from "../../utils/i18n";

	const props = withDefaults(defineProps<{
		validators?: Array<Validator<number>>;
		min?: number;
		max?: number;
		steps?: number[];
		id?: string;
	}>(), {
		steps: () => [1]
	});

	const i18n = useI18n();

	function validateInteger(val: any) {
		if (typeof val !== "string" || !val.match(/^\d+$/) || !isFinite(Number(val))) {
			return i18n.t("number-input.integer-error");
		}
	}

	function validateMin(val: any) {
		if (props.min != null) {
			const number = Number(val);
			if (isFinite(number) && number < props.min) {
				return i18n.t("number-input.min-error", { min: props.min });
			}
		}
	}

	function validateMax(val: any) {
		if (props.max != null) {
			const number = Number(val);
			if (isFinite(number) && number > props.max) {
				return i18n.t("number-input.max-error", { max: props.max });
			}
		}
	}

	const validators = computed(() => [
		validateInteger,
		validateMin,
		validateMax,
		...props.validators?.map((v): Validator<string> => (val, signal) => validateInteger(val) == null ? v(Number(val), signal) : undefined) ?? []
	]);

	const model = defineModel<number>({ required: true });

	const value = useValidatedModel({
		get: () => `${model.value}`,
		set: (val) => {
			model.value = Number(val);
		},
		validators: [validateInteger]
	});

	const valid = computed(() => validateInteger(value.value) == null);

	function handleKeyDown(e: KeyboardEvent) {
		let increase: number | undefined;
		if (e.key === "ArrowUp" && !e.shiftKey && !e.metaKey && !e.altKey) {
			increase = e.ctrlKey ? 5 : 1;
		} else if (e.key === "ArrowDown" && !e.shiftKey && !e.metaKey && !e.altKey) {
			increase = e.ctrlKey ? -5 : -1;
		}

		if (increase != null) {
			e.preventDefault();

			if (valid.value) {
				if (increase > 0 && (props.max == null || model.value < props.max)) {
					model.value = Math.min(props.max ?? Infinity, model.value + increase);
				} else if (increase < 0 && (props.min == null || model.value > props.min)) {
					model.value = Math.max(props.min ?? -Infinity, model.value + increase);
				}
			}
		}
	}
</script>

<template>
	<ValidatedField
		:value="value"
		:validators="validators"
		class="fm-number-input position-relative"
	>
		<template #default="slotProps">
			<div class="input-group has-validation">
				<template v-for="step in [...props.steps ?? []].reverse()" :key="step">
					<button type="button" class="btn btn-secondary" :disabled="!valid || (props.min != null && model - step < props.min)" @click="model -= step" tabindex="-1">
						&minus;{{step === 1 && props.steps?.length === 1 ? "" : `\u202f${step}`}}
					</button>
				</template>
				<input
					type="text"
					class="form-control"
					inputmode="numeric"
					v-model="value"
					:id="props.id"
					:ref="slotProps.inputRef"
					@keydown="handleKeyDown"
				/>
				<template v-for="step in props.steps ?? []" :key="step">
					<button type="button" class="btn btn-secondary" :disabled="!valid || (props.max != null && model - step > props.max)" @click="model += step" tabindex="-1">
						+{{step === 1 && props.steps?.length === 1 ? "" : `\u202f${step}`}}
					</button>
				</template>
				<div class="invalid-tooltip">
					{{slotProps.validationError}}
				</div>
			</div>
		</template>
	</ValidatedField>
</template>

<style lang="scss">
	.fm-number-input input {
		width: 100%;
	}
</style>