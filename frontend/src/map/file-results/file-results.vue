<div class="fm-file-results">
	<SearchResults
		:search-results="file.features"
		:layer-id="layerId"
		:auto-zoom="autoZoom"
		:union-zoom="unionZoom"
		:custom-types="file.types"
	>
		<template #before>
			<template v-if="hasViews">
				<h3>Views</h3>
				<b-list-group>
					<b-list-group-item v-for="view in file.views">
						<span>
							<a href="javascript:" @click="showView(view)">{{view.name}}</a>
							{{" "}}
							<span class="result-type">(View)</span>
						</span>
						<a href="javascript:" v-if="client.padData && client.writable == 2 && !viewExists(view)" @click="addView(view)" v-b-tooltip.hover.right="'Add this view to the map'"><Icon icon="plus" alt="Add"></Icon></a>
					</b-list-group-item>
				</b-list-group>
			</template>
			<h3 v-if="hasViews || hasTypes">Markers/Lines</h3>
		</template>

		<template #after>
			<template v-if="hasTypes">
				<h3>Types</h3>
				<b-list-group>
					<b-list-group-item v-for="type in file.types">
						<span>
							{{type.name}}
							{{" "}}
							<span class="result-type">(Type)</span>
						</span>
						<a href="javascript:" v-if="client.padData && client.writable == 2 && !typeExists(type)" @click="addType(type)" v-b-tooltip.hover.right="'Add this type to the map'"><Icon icon="plus" alt="Add"></Icon></a>
					</b-list-group-item>
				</b-list-group>
			</template>
		</template>

	</SearchResults>
</div>