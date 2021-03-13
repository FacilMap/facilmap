<div :id="`${effId}-input-container`" class="fm-shape-field-container">
	<b-input-group :id="`${effId}-input-group`">
		<b-input-group-prepend>
			<b-input-group-text><span style="width: 24px"><img :src="valueSrc"></span></b-input-group-text>
		</b-input-group-prepend>
		<b-form-input autocomplete="off" v-bind="$props" v-on="$listeners" @keydown.esc="handleEscape"></b-form-input>
	</b-input-group>

	<FieldPopover :show.sync="popoverOpen" :container="raised ? undefined : `${effId}-input-container`" :target="`${effId}-input-group`" custom-class="fm-shape-field fm-field-popover" @keydown.esc="handleEscape">
		<!-- <b-input v-model="filter" placeholder="Filter" autocomplete="off"></b-input> -->
		<ul v-html="shapesCode" @click="handleClick"></ul>
	</FieldPopover>
</div>