<FormModal
	:id="id"
	title="Edit Marker"
	dialog-class="fm-edit-marker"
	:is-saving="isSaving"
	:is-modified="isModified"
	@submit="save"
	@show="initialize"
>
	<template v-if="marker">
		<b-form-group label="Name" label-for="fm-edit-marker-name-input" label-cols-sm="3">
			<b-form-input id="fm-edit-marker-name-input" v-model="marker.name"></b-form-input>
		</b-form-group>

		<ValidationProvider name="Colour" v-slot="v" rules="required|colour">
			<b-form-group v-show="canControl('colour')" label="Colour" label-for="fm-edit-marker-colour-input" label-cols-sm="3" :state="v | validationState">
				<ColourField id="fm-edit-marker-colour-input" v-model="marker.colour" :state="v | validationState"></ColourField>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<b-form-group v-show="canControl('size')" label="Size" label-for="fm-edit-marker-size-input" label-cols-sm="3">
			<b-form-spinbutton id="fm-edit-marker-size-input" v-model="marker.size" min="15"></b-form-spinbutton>
		</b-form-group>

		<b-form-group v-show="canControl('symbol')" label="Icon" label-for="fm-edit-marker-symbol-input" label-cols-sm="3">
			<!-- TODO: Icon picker -->
			<b-form-input id="fm-edit-marker-symbol-input" v-model="marker.symbol"></b-form-input>
		</b-form-group>

		<b-form-group v-show="canControl('shape')" label="Shape" label-for="fm-edit-marker-shape-input" label-cols-sm="3">
			<!-- TODO: Shape picker -->
			<b-form-input id="fm-edit-marker-shape-input" v-model="marker.shape"></b-form-input>
		</b-form-group>

		<b-form-group v-for="(field, idx in client.types[marker.typeId].fields" :label="field.name" :label-for="`fm-edit-marker-${idx}-input`" label-cols-sm="3">
			<!-- TODO: Field input -->
			<b-form-input :id="`fm-edit-marker-${idx}-input`" v-model="marker.data[field.name]"></b-form-input>
		</b-form-group>

	<!-- <div class="btn-group pull-left dropup" uib-dropdown keyboard-nav="true" ng-if="(client.types | fmPropertyCount:{type:'marker'}) > 1">
		<button id="change-type-button" type="button" class="btn btn-default" uib-dropdown-toggle>Change type <span class="caret"></span></button>
		<ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="change-type-button" uib-dropdown-menu>
			<li role="menuitem" ng-repeat="type in client.types | fmObjectFilter:{type:'marker'}" ng-class="{active: type.id == marker.typeId}"><a href="javascript:" ng-click="marker.typeId = type.id">{{type.name}}</a></li>
		</ul>
	</div> -->
	</template>
</FormModal>