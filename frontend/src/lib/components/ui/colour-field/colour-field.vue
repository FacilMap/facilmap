<Picker v-bind="$props" v-on="$listeners" custom-class="fm-colour-field" @keydown="handleKeyDown">
	<template #preview>
		<b-input-group-text :style="previewStyle">
			<span style="width: 1.4em"></span>
		</b-input-group-text>
	</template>

	<template #default="{ isModal }">
		<div class="fm-colour-field-content">
			<b-input v-show="isModal" :value="value" @update="$emit('input', $event)" :style="previewStyle"></b-input>
			<Saturation :value="val" @change="handleChange"></Saturation>
			<Hue :value="val" @change="handleChange"></Hue>
			<ul ref="grid">
				<li v-for="colour in colours" :class="{ active: value == colour }">
					<a href="javascript:" :style="{ backgroundColor: `#${colour}` }" @click="$emit('input', colour)"></a>
				</li>
			</ul>
		</div>
	</template>
</Picker>