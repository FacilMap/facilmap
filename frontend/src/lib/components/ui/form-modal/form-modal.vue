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