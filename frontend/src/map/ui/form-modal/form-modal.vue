<ValidationObserver v-slot="observer">
	<b-modal
		:id="id"
		:title="title"
		size="lg"
		:dialog-class="dialogClass"
		:no-close-on-esc="noCancel" :no-close-on-backdrop="noCancel" :hide-header-close="noCancel" :ok-only="noCancel"
		:busy="isSaving"
		:ok-disabled="!isCreate && !isModified"
		:ok-title="isCreate ? 'Create' : 'Save'"
		@ok.prevent="observer.handleSubmit(handleSubmit)"
		@show="$emit('show')"
	>
		<b-form @submit.prevent="observer.handleSubmit(handleSubmit)">
			<template>
				<slot v-bind="observer"></slot>
			</template>
			<button type="submit" class="d-none"></button>
		</b-form>

		<slot name="after-form"></slot>
	</b-modal>
</ValidationObserver>