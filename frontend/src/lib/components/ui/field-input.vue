<script setup lang="ts">
	import { Field } from "facilmap-types";
import { computed } from "vue";

	const props = withDefaults(defineProps<{
		field: Field;
		ignoreDefault?: boolean;
		value?: string;
		id?: string;
	}>(), {
		ignoreDefault: false
	});

	const emit = defineEmits<{
		(type: "update", value: string | undefined): void;
	}>();

	const effectiveValue = computed<string | undefined>({
		get: () => (props.value ?? (props.ignoreDefault ? undefined : props.field.default) ?? ''),
		set: (value) => {
			emit("update", value);
		}
	});
</script>

<template>
	<div class="fm-field-input">
		<template v-if="field.type === 'textarea'">
			<textarea class="form-control" :id="id" v-model="effectiveValue"></textarea>
		</template>
		<template v-else-if="field.type === 'dropdown'">
			<select class="form-select" :id="id" v-model="effectiveValue">
				<option v-for="option in props.field.options">
					{{option.value}}
				</option>
			</select>
		</template>
		<template v-else-if="field.type === 'checkbox'">
			<input
				type="checkbox"
				class="form-check-input"
				:id="id"
				:checked="effectiveValue === '1'"
				@input="effectiveValue = $event ? '1' : '0'"
			/>
		</template>
		<template v-else>
			<input type="text" class="form-control" :id="id" v-model="effectiveValue"/>
		</template>
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