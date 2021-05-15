<FormModal
	:id="id"
	title="Show POIs"
	dialog-class="fm-overpass"
	:is-modified="isModified"
	@submit="save"
	@show="initialize"
	ok-title="Apply"
>
	<template v-if="!isCustomQueryMode">
		<b-form-input type="search" v-model="searchTerm" placeholder="Search…" autofocus></b-form-input>
		<hr />

		<div v-if="searchTerm" class="checkbox-grid">
			<b-form-checkbox
				v-for="preset in filteredPresets"
				:checked="preset.isChecked"
				@input="togglePreset(preset.key)"
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
							@input="togglePreset(preset.key)"
						>{{preset.label}}</b-form-checkbox>
					</div>
				</template>
			</b-tab>
		</b-tabs>
	</template>
	<template v-else>
		<ValidationProvider name="Custom query" v-slot="v" rules="customOverpassQuery" :debounce="500">
			<b-form-group :state="v | validationState(true)">
				<b-textarea v-model="customQuery" rows="5" :state="v | validationState(true)" class="text-monospace"></b-textarea>
				<template #invalid-feedback><pre v-html="v.errors[0]"></pre></template>
			</b-form-group>
		</ValidationProvider>

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

	<template #footer-left>
		<b-dropdown dropup text="Mode">
			<b-dropdown-item :active="!isCustomQueryMode" @click="isCustomQueryMode = false">Presets</b-dropdown-item>
			<b-dropdown-item :active="isCustomQueryMode" @click="isCustomQueryMode = true">Custom query</b-dropdown-item>
		</b-dropdown>
	</template>
</FormModal>