<div class="fm-overpass-form">
	<template v-if="!mapContext.overpassIsCustom">
		<b-form-input type="search" v-model="searchTerm" placeholder="Filter…" autofocus></b-form-input>
		<hr />

		<div v-if="searchTerm" class="checkbox-grid">
			<b-form-checkbox
				v-for="preset in filteredPresets"
				:checked="preset.isChecked"
				@input="togglePreset(preset.key, $event)"
			>{{preset.label}}</b-form-checkbox>
		</div>

		<b-tabs v-else pills lazy v-model="activeTab">
			<b-tab v-for="(category, idx) in categories" :title="category.label">
				<template #title>
					{{category.label}}
					<b-badge v-if="category.checked > 0" :variant="activeTab == idx ? 'secondary' : 'primary'">{{category.checked}}</b-badge>
				</template>
				<template v-for="presets in category.presets">
					<hr />
					<div class="checkbox-grid">
						<b-form-checkbox
							v-for="preset in presets"
							:checked="preset.isChecked"
							@input="togglePreset(preset.key, $event)"
						>{{preset.label}}</b-form-checkbox>
					</div>
				</template>
			</b-tab>
		</b-tabs>
	</template>
	<template v-else>
		<b-form-group :state="customQueryValidationState">
			<b-textarea v-model="customQuery" rows="5" :state="customQueryValidationState" class="text-monospace" @input="handleCustomQueryInput"></b-textarea>
			<template #invalid-feedback><pre>{{customQueryValidationError}}</pre></template>
		</b-form-group>

		<hr />

		<p>
			Enter an <a href="https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#The_Query_Statement" target="_blank">Overpass query statement</a>
			here. Settings and an <code>out</code> statement are added automatically in the background. For ways and relations, a marker will be shown at
			the geometric centre, no lines or polygons are drawn.
		</p>
		<p>
			Example queries are <code>nwr[amenity=parking]</code> to get parking places or
			<code>(nwr[amenity=atm];nwr[amenity=bank][atm][atm!=no];)</code> for ATMs.
		</p>
	</template>

	<hr />

	<b-button-toolbar>
		<b-button
			@click="toggleIsCustom()"
			:pressed="mapContext.overpassIsCustom"
		>Custom query</b-button>
	</b-button-toolbar>
</div>