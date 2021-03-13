<ValidationObserver v-slot="observer">
	<b-modal
		:id="id"
		:title="title"
		:size="size || 'lg'"
		:dialog-class="dialogClass"
		:no-close-on-esc="noCancel" :no-close-on-backdrop="noCancel" :hide-header-close="noCancel" :ok-only="noCancel"
		:busy="isSaving"
		:ok-disabled="!isCreate && !isModified"
		:ok-title="okTitle || (isCreate ? 'Create' : 'Save')"
		@ok.prevent="observer.handleSubmit(handleSubmit)"
		@show="$emit('show')"
		scrollable
	>
		<b-form @submit.prevent="observer.handleSubmit(handleSubmit)">
			<template>
				<slot v-bind="observer"></slot>
			</template>
			<button type="submit" class="d-none"></button>
		</b-form>

		<slot name="after-form"></slot>

		<template #modal-footer="{ ok, cancel }">
			<slot name="footer-left"></slot>
			<div style="flex-grow: 1"></div>
			<b-button v-if="!noCancel" :variant="noCancel || isModified || isCreate ? 'secondary' : 'primary'" @click="cancel" :disabled="isSaving">
				{{isModified ? "Cancel" : "Close"}}
			</b-button>
			<b-button v-if="noCancel || isModified || isCreate" variant="primary" @click="ok" :disabled="isSaving">
				<b-spinner small v-if="isSaving"></b-spinner>
				{{isCreate ? "Create" : "Save"}}
			</b-button>
		</template>
	</b-modal>
</ValidationObserver>