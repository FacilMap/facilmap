<script setup lang="ts">
	import WithRender from "./form-modal.vue";
	import Vue, { ref } from "vue";
	import Component from "vue-class-component";
	import { ValidationObserver } from "vee-validate";
	import { Prop, Ref } from "vue-property-decorator";
	import { getUniqueId } from "../../../utils/utils";
import { useModal } from "../../../utils/modal";

	const props = withDefaults(defineProps<{
		show?: boolean;
		title?: string;
		dialogClass?: string;
		noCancel?: boolean;
		isSaving?: boolean;
		isBusy?: boolean;
		isCreate?: boolean;
		isModified?: boolean;
		size?: string;
		okTitle?: string;
	}>(), {
		isModified: true
	});

	const emit = defineEmits<{
		(type: "hidden"): void;
		(type: "submit"): void;
	}>();

	const modal = useModal({
		emit
	});

	const id = getUniqueId();

	const submit = () => {
		if (formRef.value!.checkValidity()) {
			formSubmitted.value = true;

			emit("submit");
		} else {
			formTouched.value = true;
		}
	};

	async function handleSubmit(observer: InstanceType<typeof ValidationObserver>): Promise<void> {
		if (await observer.validate())
			this.$emit("submit");
		else {
			const error = this.form.querySelector(".is-invalid");
			if (error)
				error.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}
</script>

<template>
	<div
		class="modal fade fm-form-modal"
		tabindex="-1"
		aria-hidden="true"
		:ref="modal.ref"
	>
		<div class="modal-dialog">
			<form class="modal-content" @submit.prevent="submit()" novalidate ref="formRef" :class="{ 'was-validated': formTouched }">
				<div class="modal-header">
					<h1 class="modal-title fs-5">{{props.title}}</h1>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body">
					<div class="row mb-3" :class="{ 'was-validated': nameTouched }">
						<label :for="`${id}-name`" class="col-sm-4 col-form-label">New name</label>
						<div class="col-sm-8">
							<input :id="`${id}-name`" class="form-control" type="text" v-model="newPatternName" autofocus v-validity="nameError" @input="nameTouched = true" @blur="nameTouched = true">
							<div v-if="nameError" class="invalid-feedback">
								{{nameError}}
							</div>
						</div>
					</div>

					<div class="row mb-3">
						<label :for="`${id}-tune`" class="col-sm-4 col-form-label">{{copy ? 'Copy' : 'Move'}} to different tune?</label>
						<div class="col-sm-8">
							<select :id="`${id}-tune`" class="form-select" v-model="newTuneName">
								<option v-for="tuneName in targetTuneOptions" :key="tuneName">{{tuneName}}</option>
							</select>
						</div>
					</div>

					<div class="row mb-3">
						<label :for="`${id}-copy`" class="col-sm-4 col-form-label">Mode</label>
						<div class="col-sm-8">
							<select :id="`${id}-copy`" class="form-select" v-model="copy" :disabled="!isCustom">
								<option :value="false">{{tuneName == newTuneName ? 'Rename' : 'Move'}}</option>
								<option :value="true">Copy</option>
							</select>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-light" @click="modal.hide()">Cancel</button>
					<button type="submit" class="btn btn-primary" @click="submit()">OK</button>
				</div>
			</form>
		</div>
	</div>

	<ValidationObserver v-slot="observer">
		<b-modal
			:id="id"
			:title="title"
			:size="size || 'lg'"
			:dialog-class="dialogClass"
			:no-close-on-esc="isSaving || isBusy || noCancel" :no-close-on-backdrop="isSaving || isBusy || noCancel || isModified" :hide-header-close="noCancel"
			@close="(isSaving || isBusy) && $event.preventDefault()"
			@ok.prevent="handleSubmit(observer)"
			@show="$emit('show')"
			@hidden="$emit('hidden')"
			scrollable
		>
			<b-form @submit.prevent="handleSubmit(observer)" ref="form">
				<template>
					<slot v-bind="observer"></slot>
				</template>
				<button type="submit" class="d-none"></button>
			</b-form>

			<slot name="after-form"></slot>

			<template #modal-footer="{ ok, cancel }">
				<slot name="footer-left"></slot>
				<div style="flex-grow: 1"></div>
				<b-button v-if="!noCancel" variant="secondary" @click="cancel" :disabled="isSaving || isBusy">
					{{isModified ? "Cancel" : "Close"}}
				</b-button>
				<b-button v-if="noCancel || isModified || isCreate" variant="primary" @click="ok" :disabled="isSaving || isBusy">
					<b-spinner small v-if="isSaving"></b-spinner>
					{{okTitle || (isCreate ? 'Create' : 'Save')}}
				</b-button>
			</template>
		</b-modal>
	</ValidationObserver>
</template>

<style lang="scss">
</style>