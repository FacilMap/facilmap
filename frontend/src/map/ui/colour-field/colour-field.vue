<div :id="`${effId}-container`" class="fm-colour-field-container">
	<b-input-group :id="`${effId}-input-group`">
		<b-input-group-prepend>
			<b-input-group-text :style="{ backgroundColor: `#${value}` }">
				<span style="width: 24px"></span>
			</b-input-group-text>
		</b-input-group-prepend>
		<b-form-input v-bind="$props" v-on="$listeners" @keydown.esc="handleEscape"></b-form-input>
	</b-input-group>

	<FieldPopover :show.sync="popoverOpen" :container="raised ? undefined : `${effId}-container`" :target="`${effId}-input-group`" custom-class="fm-colour-field" @keydown.esc="handleEscape">
		<Saturation :value="val" @change="handleChange"></Saturation>
		<Hue :value="val" @change="handleChange"></Hue>
		<ul>
			<li v-for="colour in colours">
				<a href="javascript:" :style="{ backgroundColor: `#${colour}` }" @click="$emit('input', colour)"></a>
			</li>
		</ul>
	</FieldPopover>
</div>