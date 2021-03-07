<div :id="`${id}-input-container`" class="fm-symbol-field-container">
	<b-input-group :id="`${id}-input-group`">
		<b-input-group-prepend>
			<b-input-group-text><Icon :icon="value"></Icon></b-input-group-text>
		</b-input-group-prepend>
		<b-form-input v-bind="$props" v-on="$listeners" @keydown.esc="handleEscape"></b-form-input>
	</b-input-group>

	<FieldPopover :show.sync="popoverOpen" :container="`${id}-input-container`" :target="`${id}-input-group`" custom-class="fm-symbol-field fm-field-popover" @keydown.esc="handleEscape">
		<b-input v-model="filter" placeholder="Filter"></b-input>
		<ul v-html="symbolsCode" @click="handleClick"></ul>
	</FieldPopover>
</div>