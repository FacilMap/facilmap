<div :id="`${effId}-input-container`" class="fm-symbol-field-container">
	<b-input-group :id="`${effId}-input-group`">
		<b-input-group-prepend>
			<b-input-group-text><Icon :icon="value"></Icon></b-input-group-text>
		</b-input-group-prepend>
		<b-form-input v-bind="$props" v-on="$listeners" @keydown.esc="handleEscape"></b-form-input>
	</b-input-group>

	<FieldPopover :show.sync="popoverOpen" :container="raised ? undefined : `${effId}-input-container`" :target="`${effId}-input-group`" custom-class="fm-symbol-field fm-field-popover" @keydown.esc="handleEscape">
		<b-input v-model="filter" placeholder="Filter"></b-input>
		<ul v-html="symbolsCode" @click="handleClick"></ul>
	</FieldPopover>
</div>