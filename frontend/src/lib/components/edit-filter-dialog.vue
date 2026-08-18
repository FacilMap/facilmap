<script setup lang="ts">
	import { filterHasError } from "facilmap-utils";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { computed, ref } from "vue";
	import { injectContextRequired, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "./ui/validated-form/validated-field.vue";
	import { useI18n } from "../utils/i18n";
	import FilterSyntax from "./ui/filter-syntax.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const modalRef = ref<InstanceType<typeof ModalDialog>>();
	const filter = ref(mapContext.value.filter ?? "");

	function validateFilter(filter: string) {
		return filterHasError(filter)?.message;
	}

	const isModified = computed(() => {
		return filter.value != (mapContext.value.filter ?? "");
	});

	function save(): void {
		mapContext.value.components.map.setFmFilter(filter.value || undefined);
		modalRef.value?.modal.hide();
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('edit-filter-dialog.title')"
		class="fm-edit-filter"
		:isModified="isModified"
		@submit="save"
		:okLabel="isModified ? i18n.t('edit-filter-dialog.apply') : undefined"
		ref="modalRef"
		@hidden="emit('hidden')"
	>
		<p>{{i18n.t("edit-filter-dialog.introduction")}}</p>

		<ValidatedField
			:value="filter"
			:validators="[
				validateFilter
			]"
			:reportValid="!!filter"
			immediate
		>
			<template #default="slotProps">
				<textarea
					class="form-control text-monospace"
					v-model="filter"
					rows="5"
					:ref="slotProps.inputRef"
				></textarea>
				<div class="invalid-feedback" v-if="slotProps.validationError">
					<pre>{{slotProps.validationError}}</pre>
				</div>
			</template>
		</ValidatedField>

		<hr />

		<FilterSyntax></FilterSyntax>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-edit-filter {
		.modal-body.modal-body, form {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		hr {
			width: 100%;
		}

		.fm-filter-syntax {
			overflow: auto;
			margin-right: -16px;
			padding-right: 16px;
			min-height: 150px;
			max-width: 100%;
		}

		pre {
			color: inherit;
			font-size: inherit;
		}
	}
</style>