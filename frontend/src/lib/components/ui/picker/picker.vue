<div :id="`${id}-container`" class="fm-picker" ref="container">
	<b-input-group :id="`${id}-input-group`">
		<b-input-group-prepend @click="input.focus()">
			<slot name="preview"></slot>
		</b-input-group-prepend>
		<b-form-input
			autocomplete="off"
			:disabled="disabled"
			:value="value"
			:state="state"
			:id="id"
			@update="$emit('input', $event)"
			@blur="handleInputBlur"
			@click="handleInputClick"
			ref="input"
			@keydown="handleInputKeyDown"
		></b-form-input>
	</b-input-group>

	<b-popover
		:target="`${id}-input-group`"
		:container="body" 
		triggers="manual"
		placement="bottom"
		:fallback-placement="[]"
		:custom-class="`fm-picker-popover ${uniqueClass} ${customClass}`"
		:delay="0"
		boundary="viewport"
		@show="handleOpenPopover"
		@hidden="handleClosePopover"
		:show.sync="popoverOpen"
	>
		<div @focusin.stop="handlePopoverFocus" class="fm-field-popover-content">
			<slot :is-modal="false" :close="close"></slot>
		</div>
	</b-popover>

	<b-modal
		:id="`${id}-modal`"
		v-model="modalOpen"
		:body-class="`fm-picker-modal ${customClass}`"
		ok-only
		hide-header
		scrollable
	>
		<slot :is-modal="true" :close="close"></slot>
	</b-modal>
</div>