<script setup lang="ts">
	import type { Field, Line, MapData, Marker, Type } from "facilmap-types";
	import { computed } from "vue";
	import { formatFieldName, formatFieldValue, markdownBlock, normalizeFieldValue } from "facilmap-utils";

	const props = withDefaults(defineProps<{
		mapData?: MapData;
		type?: Type;
		object?: Marker | Line;
		field: Field;
		noHint?: boolean;
		ignoreDefault?: boolean;
		modelValue?: string;
		id?: string;
		showCheckboxLabel?: boolean;
	}>(), {
		ignoreDefault: false
	});

	const emit = defineEmits<{
		"update:modelValue": [value: string | undefined];
	}>();

	const value = computed<string | undefined>({
		get: () => normalizeFieldValue(props.field, props.modelValue, props.ignoreDefault),
		set: (value) => {
			emit("update:modelValue", value);
		}
	});
</script>

<template>
	<div class="fm-field-input">
		<template v-if="field.type === 'formula'">
			<div
				class="form-control-plaintext"
				:id="id"
				v-html="props.mapData && props.type && props.object ? formatFieldValue(props.mapData, props.type, field, props.object, true) : ''"
			/>
		</template>
		<template v-else-if="field.type === 'textarea'">
			<textarea class="form-control" :id="id" v-model="value"></textarea>
		</template>
		<template v-else-if="field.type === 'dropdown'">
			<select class="form-select" :id="id" v-model="value">
				<option v-for="option in props.field.options" :key="option.value">
					{{option.value}}
				</option>
			</select>
		</template>
		<template v-else-if="field.type === 'checkbox'">
			<template v-if="props.showCheckboxLabel">
				<div class="form-check">
					<input
						type="checkbox"
						class="form-check-input"
						:id="id"
						:checked="value === '1'"
						@input="value = ($event.target as HTMLInputElement).checked ? '1' : '0'"
					/>
					<label v-if="props.showCheckboxLabel" :for="id" class="form-check-label">
						{{formatFieldName(field.name)}}
					</label>
				</div>
			</template>
			<template v-else>
				<input
					type="checkbox"
					class="form-check-input fm-large-checkbox"
					:id="id"
					:checked="value === '1'"
					@input="value = ($event.target as HTMLInputElement).checked ? '1' : '0'"
				/>
			</template>
		</template>
		<template v-else>
			<input type="text" class="form-control" :id="id" v-model="value"/>
		</template>

		<div
			v-if="!props.noHint && field.type !== 'formula' && field.editHint"
			class="form-text"
			v-html="markdownBlock(field.editHint, true)"
		></div>
	</div>
</template>