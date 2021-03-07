<div :id="`${id}-input-container`" class="fm-shape-field-container">
	<b-input-group :id="`${id}-input-group`">
		<b-input-group-prepend>
			<b-input-group-text><span style="width: 24px"><img :src="valueSrc"></span></b-input-group-text>
		</b-input-group-prepend>
		<b-form-input v-bind="$props" v-on="$listeners" @keydown.esc="handleEscape"></b-form-input>
	</b-input-group>

	<FieldPopover :show.sync="popoverOpen" :container="`${id}-input-container`" :target="`${id}-input-group`" custom-class="fm-shape-field fm-field-popover" @keydown.esc="handleEscape">
		<!-- <b-input v-model="filter" placeholder="Filter"></b-input> -->
		<ul v-html="shapesCode" @click="handleClick"></ul>
	</FieldPopover>
</div>