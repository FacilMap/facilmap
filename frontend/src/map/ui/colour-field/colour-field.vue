<span>
	<b-input-group>
		<b-input-group-prepend>
			<b-button :id="`${id}-colour-field`" :style="{ backgroundColor: `#${value}` }" class="dropdown-toggle"></b-button>
		</b-input-group-prepend>
		<b-form-input v-bind="$props" v-on="$listeners"></b-form-input>
	</b-input-group>

	<b-popover :target="`${id}-colour-field`" triggers="click blur" placement="bottom" custom-class="fm-colour-field">
		<Saturation :value="val" @change="handleChange"></Saturation>
		<Hue :value="val" @change="handleChange"></Hue>
		<ul>
			<li v-for="colour in colours">
				<a href="javascript:" :style="{ backgroundColor: `#${colour}` }" @click="$emit('input', colour)"></a>
			</li>
		</ul>
	</b-popover>
</span>