<b-button-group class="fm-route-mode">
	<b-button
		v-for="(mode, idx) in constants.modes"
		:pressed="decodedMode.mode == mode"
		@click="setMode(mode, '')"
		:tabindex="tabindex + idx"
		:title="`Go ${constants.modeTitle[mode]}`"
		v-b-tooltip.hover.top
		:disabled="disabled"
	>
		<Icon :icon="constants.modeIcon[mode]" :alt="constants.modeAlt[mode]"></Icon>
	</b-button>

	<b-dropdown
		id="fm-route-mode-customise"
		:tabindex="tabindex + constants.modes.length"
		title="Customise"
		v-b-tooltip.hover.top
		:disabled="disabled"
	>
		<template #button-content><Icon icon="cog" alt="Custom"/></template>
		<b-dropdown-item @click.native.capture.stop.prevent="decodedMode.details = !decodedMode.details"><Icon :icon="decodedMode.details ? 'check' : 'unchecked'"></Icon> Load route details (elevation, road types, …)</b-dropdown-item>
		<b-dropdown-divider></b-dropdown-divider>
		<b-dropdown-item class="column" v-for="t in types" @click.native.capture.stop.prevent="setMode(t[0], t[1])"><Icon :icon="isTypeActive(t[0], t[1]) ? 'check' : 'unchecked'"></Icon> {{constants.typeText[t[0]][t[1]]}}</b-dropdown-item>
		<b-dropdown-divider></b-dropdown-divider>
		<b-dropdown-item class="column" v-if="decodedMode.mode" v-for="(pText, p) in constants.preferenceText" @click.native.capture.stop.prevent="decodedMode.preference = p"><Icon :icon="decodedMode.preference == p ? 'check' : 'unchecked'"></Icon> {{pText}}</b-dropdown-item>
		<b-dropdown-divider></b-dropdown-divider>
		<b-dropdown-item class="column" v-for="avoid in constants.avoid" v-if="constants.avoidAllowed[avoid](decodedMode.mode, decodedMode.type)" @click.native.capture.stop.prevent="toggleAvoid(avoid)"><Icon :icon="decodedMode.avoid.includes(avoid) ? 'check' : 'unchecked'"></Icon> Avoid {{constants.avoidText[avoid]}}</b-dropdown-item>
	</b-dropdown>
</b-button-group>