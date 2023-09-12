<script setup lang="ts">
	import { Component, Prop, Ref, Watch } from "vue-property-decorator";
	import WithRender from "./pad-settings.vue";
	import Vue, { computed, ref, watch } from "vue";
	import { extend, ValidationProvider } from "vee-validate";
	import { PadData, PadDataCreate, PadDataUpdate } from "facilmap-types";
	import { clone, generateRandomPadId } from "facilmap-utils";
	import { Client, InjectClient, InjectContext } from "../../utils/decorators";
	import { getUniqueId, mergeObject } from "../../utils/utils";
	import { isEqual } from "lodash-es";
	import copyToClipboard from "copy-to-clipboard";
	import FormModal from "../ui/form-modal/form-modal";
	import { showErrorToast } from "../../utils/toasts";
	import "./pad-settings.scss";
	import { Context } from "../facilmap/facilmap";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../../utils/client";
	import { hideToast, showToast } from "../../utils/toasts/toasts.vue";
	import { useModal } from "../../utils/modal";
	import { showConfirm } from "../../utils/alert.vue";

	extend("padId", {
		validate: (id: string) => !id.includes("/"),
		message: "May not contain a slash."
	});

	extend("padIdUnique", {
		validate: (id: string, args: any) => {
			const padData: PadData = args.padData;
			return !padData || [padData.id, padData.writeId, padData.adminId].filter((v) => v == id).length <= 1;
		},
		message: "The same link cannot be used for different access levels.",
		params: ["padData"]
	})

	const context = injectContextRequired();
	const client = injectClientRequired();


	@Ref() padDataValidationProvider?: InstanceType<typeof ValidationProvider>;

	const props = defineProps<{
		show?: boolean;
		proposedAdminId?: string;
		noCancel?: boolean;
		isCreate?: boolean;
	}>();

	const emit = defineEmits<{
		(type: 'update:show', show: boolean): void;
	}>();

	const id = getUniqueId();
	const isSaving = ref(false);
	const isDeleting = ref(false);
	const deleteConfirmation = ref("");
	const padData = ref<PadDataCreate | PadDataUpdate>(undefined as any);

	const modal = useModal({
		show: computed(() => !!props.show),
		emit,
		onShow: () => {
			if (props.isCreate) {
				padData.value = {
					name: "New FacilMap",
					searchEngines: false,
					description: "",
					clusterMarkers: false,
					adminId: (props.proposedAdminId || generateRandomPadId(16)),
					writeId: generateRandomPadId(14),
					id: generateRandomPadId(12),
					legend1: "",
					legend2: "",
					defaultViewId: null
				};
			} else {
				padData.value = clone(client.value.padData as PadDataUpdate);
			}
		},
		onHide: () => {
			padData.value = undefined; // Disables watchers
		}
	});

	const isModified = computed(() => !isEqual(padData.value, client.value.padData));

	watch(() => client.value.padData, (newPadData, oldPadData) => {
		if (!props.isCreate && padData.value)
			mergeObject(oldPadData, newPadData, padData.value);
	}, { deep: true });

	watch(() => padData.value, (padData) => {
		this.padDataValidationProvider?.validate({ ...padData });
	}, { deep: true );

	async function save(): Promise<void> {
		isSaving.value = true;
		hideToast(`fm${context.id}-pad-settings-error`);

		try {
			if(props.isCreate)
				await client.value.createPad(padData.value as PadDataCreate);
			else
				await client.value.editPad(padData.value);

			modal.hide();
		} catch (err) {
			showErrorToast(`fm${context.id}-pad-settings-error`, props.isCreate ? "Error creating map" : "Error saving map settings", err);
		} finally {
			isSaving.value = false;
		}
	};

	function copy(text: string): void {
		copyToClipboard(text);
		showToast(undefined, "Map link copied", "The map link was copied to the clipboard.", { variant: "success" });
	}

	async function deletePad(): Promise<void> {
		hideToast(`fm${context.id}-pad-settings-error`);

		if (!await showConfirm({
			title: "Delete map",
			message: `Are you sure you want to delete the map “${padData.value.name}”? Deleted maps cannot be restored!`,
			variant: "danger"
		})) {
			return;
		}

		isDeleting.value = true;

		try {
			await client.value.deletePad();
			modal.hide();
		} catch (err) {
			showErrorToast(`fm${context.id}-pad-settings-error`, "Error deleting map", err);
		} finally {
			isDeleting.value = false;
		}
	};
</script>

<template>
	<Teleport to="body">
		<FormModal
			:id="id"
			:title="isCreate ? 'Create collaborative map' : 'Map settings'"
			dialog-class="fm-pad-settings"
			:no-cancel="noCancel"
			:is-saving="isSaving"
			:is-busy="isDeleting"
			:is-create="isCreate"
			:is-modified="isModified"
			@submit="save"
		>
			<template v-if="padData">
				<ValidationProvider name="Admin link" v-slot="v" rules="required|padId|padIdUnique:@padData">
					<b-form-group label="Admin link" :label-for="`${id}-admin-link-input`" label-cols-sm="3" :state="v | validationState" class="pad-link">
						<b-input-group :prepend="context.baseUrl">
							<b-form-input :id="`${id}-admin-link-input`" v-model="padData.adminId" :state="v | validationState"></b-form-input>
							<b-input-group-append>
								<b-button @click="copy(context.baseUrl + encodeURIComponent(padData.adminId))">Copy</b-button>
							</b-input-group-append>
						</b-input-group>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
						<template #description>
							When opening the map through this link, all parts of the map can be edited, including the map settings, object types and views.
						</template>
					</b-form-group>
				</ValidationProvider>

				<ValidationProvider name="Editable link" v-slot="v" rules="required|padId|padIdUnique:@padData">
					<b-form-group label="Editable link" :label-for="`${id}-write-link-input`" label-cols-sm="3" :state="v | validationState" class="pad-link">
						<b-input-group :prepend="context.baseUrl">
							<b-form-input :id="`${id}-write-link-input`" v-model="padData.writeId" :state="v | validationState"></b-form-input>
							<b-input-group-append>
								<b-button @click="copy(context.baseUrl + encodeURIComponent(padData.writeId))">Copy</b-button>
							</b-input-group-append>
						</b-input-group>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
						<template #description>
							When opening the map through this link, markers and lines can be added, changed and deleted, but the map settings, object types and views cannot be modified.
						</template>
					</b-form-group>
				</ValidationProvider>

				<ValidationProvider name="Read-only link" v-slot="v" rules="required|padId|padIdUnique:@padData">
					<b-form-group label="Read-only link" :label-for="`${id}-read-link-input`" label-cols-sm="3" :state="v | validationState" class="pad-link">
						<b-input-group :prepend="context.baseUrl">
							<b-form-input :id="`${id}-read-link-input`" v-model="padData.id" :state="v | validationState"></b-form-input>
							<b-input-group-append>
								<b-button @click="copy(context.baseUrl + encodeURIComponent(padData.id))">Copy</b-button>
							</b-input-group-append>
						</b-input-group>
						<b-form-invalid-feedback>{{v.errors[0]}}</b-form-invalid-feedback>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
						<template #description>
							When opening the map through this link, markers, lines and views can be seen, but nothing can be changed.
						</template>
					</b-form-group>
				</ValidationProvider>

				<b-form-group :label-for="`${id}-pad-name-input`" label="Map name" label-cols-sm="3">
					<b-form-input :id="`${id}-pad-name-input`" v-model="padData.name"></b-form-input>
				</b-form-group>

				<b-form-group :label-for="`${id}-search-engines-input`" label="Search engines" label-cols-sm="3" label-class="pt-0">
					<b-form-checkbox :id="`${id}-search-engines-input`" v-model="padData.searchEngines">Accessible for search engines</b-form-checkbox>
					<template #description>
						If this is enabled, search engines like Google will be allowed to add the read-only version of this map.
					</template>
				</b-form-group>

				<b-form-group v-show="padData.searchEngines" label="Short description" :label-for="`${id}-description-input`" label-cols-sm="3">
					<b-form-input :id="`${id}-description-input`" v-model="padData.description"></b-form-input>
					<template #description>
						This description will be shown under the result in search engines.
					</template>
				</b-form-group>

				<b-form-group label="Cluster markers" :label-for="`${id}-cluster-markers-input`" label-cols-sm="3" label-class="pt-0">
					<b-form-checkbox :id="`${id}-cluster-markers-input`" v-model="padData.clusterMarkers">Cluster markers</b-form-checkbox>
					<template #description>
						If enabled, when there are many markers in one area, they will be replaced by a placeholder at low zoom levels. This improves performance on maps with many markers.
					</template>
				</b-form-group>

				<b-form-group label="Legend text" :label-for="`${id}-legend1-input`" label-cols-sm="3">
					<b-form-textarea :id="`${id}-legend1-input`" v-model="padData.legend1"></b-form-textarea>
					<b-form-textarea :id="`${id}-legend2-input`" v-model="padData.legend2"></b-form-textarea>
					<template #description>
						Text that will be shown above and below the legend. Can be formatted with <a href="http://commonmark.org/help/" target="_blank">Markdown</a>.
					</template>
				</b-form-group>

				<ValidationProvider vid="padData" ref="padDataValidationProvider" v-slot="v" rules="" immediate>
					<b-form-group :state="v | validationState">
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>
			</template>

			<template #after-form v-if="padData && !isCreate">
				<hr/>

				<b-form @submit.prevent="deleteConfirmation == 'DELETE' && deletePad()">
					<b-form-group label="Delete map" :label-for="`${id}-delete-input`" label-cols-sm="3">
						<b-input-group>
							<b-form-input :id="`${id}-delete-input`" v-model="deleteConfirmation" autocomplete="off"></b-form-input>
							<b-input-group-append>
								<b-button type="submit" variant="danger" :disabled="isDeleting || isSaving || deleteConfirmation != 'DELETE'">
									<b-spinner small v-if="isDeleting"></b-spinner>
									Delete map
								</b-button>
							</b-input-group-append>
						</b-input-group>
						<template #description>
							To delete this map, type <code>DELETE</code> into the field and click the “Delete map” button.
						</template>
					</b-form-group>
				</b-form>
			</template>
		</FormModal>
	</Teleport>
</template>

<style lang="scss">
	.fm-pad-settings {
		.pad-link input {
			min-width: 11rem;
		}
	}
</style>