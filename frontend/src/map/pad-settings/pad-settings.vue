<FormModal
	:id="id"
	:title="isCreate ? 'Start collaborative map' : 'Map settings'"
	dialog-class="fm-pad-settings"
	:no-cancel="noCancel"
	:is-saving="isSaving"
	:is-create="isCreate"
	:is-modified="isModified"
	@submit="save"
	@show="initialize"
	@hidden="clear"
>
	<template v-if="padData">
		<ValidationProvider name="Admin link" v-slot="v" rules="required|padId|padIdUnique:@padData">
			<b-form-group label="Admin link" label-for="admin-link-input" label-cols-sm="3" :state="v | validationState" class="pad-link">
				<b-input-group :prepend="urlPrefix">
					<b-form-input id="admin-link-input" v-model="padData.adminId" :state="v | validationState"></b-form-input>
					<b-input-group-append>
						<b-button @click="copy(urlPrefix + padData.adminId)">Copy</b-button>
					</b-input-group-append>
				</b-input-group>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				<template #description>
					When opening the map through this link, all parts of the map can be edited, including the map settings, object types and views.
				</template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider name="Editable link" v-slot="v" rules="required|padId|padIdUnique:@padData">
			<b-form-group label="Editable link" label-for="write-link-input" label-cols-sm="3" :state="v | validationState" class="pad-link">
				<b-input-group :prepend="urlPrefix">
					<b-form-input id="write-link-input" v-model="padData.writeId" :state="v | validationState"></b-form-input>
					<b-input-group-append>
						<b-button @click="copy(urlPrefix + padData.writeId)">Copy</b-button>
					</b-input-group-append>
				</b-input-group>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				<template #description>
					When opening the map through this link, markers and lines can be added, changed and deleted, but the map settings, object types and views cannot be modified.
				</template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider name="Read-only link" v-slot="v" rules="required|padId|padIdUnique:@padData">
			<b-form-group label="Read-only link" label-for="read-link-input" label-cols-sm="3" :state="v | validationState" class="pad-link">
				<b-input-group :prepend="urlPrefix">
					<b-form-input id="read-link-input" v-model="padData.id" :state="v | validationState"></b-form-input>
					<b-input-group-append>
						<b-button @click="copy(urlPrefix + padData.id)">Copy</b-button>
					</b-input-group-append>
				</b-input-group>
				<b-form-invalid-feedback>{{v.errors[0]}}</b-form-invalid-feedback>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				<template #description>
					When opening the map through this link, markers, lines and views can be seen, but nothing can be changed.
				</template>
			</b-form-group>
		</ValidationProvider>

		<b-form-group label-for="pad-name-input" label="Map name" label-cols-sm="3">
			<b-form-input id="pad-name-input" v-model="padData.name"></b-form-input>
		</b-form-group>

		<b-form-group label-for="search-engines-input" label="Search engines" label-cols-sm="3" label-class="pt-0">
			<b-form-checkbox id="search-engines-input" v-model="padData.searchEngines">Accessible for search engines</b-form-checkbox>
			<template #description>
				If this is enabled, search engines like Google will be allowed to add the read-only version of this map.
			</template>
		</b-form-group>

		<b-form-group v-show="padData.searchEngines" label="Short description" label-for="description-input" label-cols-sm="3">
			<b-form-input id="description-input" v-model="padData.description"></b-form-input>
			<template #description>
				This description will be shown under the result in search engines.
			</template>
		</b-form-group>

		<b-form-group label="Cluster markers" label-for="cluster-markers-input" label-cols-sm="3" label-class="pt-0">
			<b-form-checkbox id="cluster-markers-input" v-model="padData.clusterMarkers">Cluster markers</b-form-checkbox>
			<template #description>
				If enabled, when there are many markers in one area, they will be replaced by a placeholder at low zoom levels. This improves performance on maps with many markers.
			</template>
		</b-form-group>

		<b-form-group label="Legend text" label-for="legend1-input" label-cols-sm="3">
			<b-form-textarea id="legend1-input" v-model="padData.legend1"></b-form-textarea>
			<b-form-textarea id="legend2-input" v-model="padData.legend2"></b-form-textarea>
			<template #description>
				Text that will be shown above and below the legend. Can be formatted with <a href="http://commonmark.org/help/" target="_blank">Markdown</a>.
			</template>
		</b-form-group>

		<ValidationProvider vid="padData" ref="padDataValidationProvider" v-slot="v" rules="" immediate>
			<b-form-group :state="v | validationState">
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>
	</template>

	<template #after-form v-if="padData && !isCreate">
		<hr/>

		<b-form @submit.prevent="deleteConfirmation == 'DELETE' && deletePad()">
			<b-form-group label="Delete map" label-for="delete-input" label-cols-sm="3">
				<b-input-group>
					<b-form-input id="delete-input" v-model="deleteConfirmation" autocomplete="off"></b-form-input>
					<b-input-group-append>
						<b-button type="submit" variant="danger" :disabled="deleteConfirmation != 'DELETE'">Delete map</b-button>
					</b-input-group-append>
				</b-input-group>
				<template #description>
					To delete this map, type <code>DELETE</code> into the field and click the “Delete map” button.
				</template>
			</b-form-group>
		</b-form>
	</template>
</FormModal>