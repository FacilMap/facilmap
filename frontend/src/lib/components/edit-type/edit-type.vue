<script setup lang="ts">
	import { Field, ID, Line, Marker, Type, TypeUpdate } from "facilmap-types";
	import { clone } from "facilmap-utils";
	import { canControl, IdType } from "../../utils/utils";
	import { mergeTypeObject } from "./edit-type-utils";
	import { isEqual } from "lodash-es";
	import { showErrorToast } from "../ui/toasts/toasts.vue";
	import ColourField from "../ui/colour-field/colour-field";
	import ShapeField from "../ui/shape-field/shape-field";
	import SymbolField from "../ui/symbol-field/symbol-field";
	import RouteMode from "../ui/route-mode/route-mode";
	import draggable from "vuedraggable";
	import FieldInput from "../ui/field-input/field-input";
	import Icon from "../ui/icon/icon";
	import WidthField from "../ui/width-field/width-field";
	import SizeField from "../ui/size-field/size-field";
	import EditTypeDropdown from "./edit-type-dropdown";
	import { Context } from "../facilmap/facilmap";

	extend("uniqueFieldName", {
		validate: (value: string, args: any) => {
			const type: Type | undefined = args.type;
			return !type || type.fields.filter((field) => field.name == value).length <= 1;
		},
		message: "Multiple fields cannot have the same name.",
		params: ["type"]
	});

	@WithRender
	@Component({
		components: { ColourField, draggable, EditTypeDropdown, FieldInput, FormModal, Icon, RouteMode, ShapeField, SizeField, SymbolField, ValidationProvider, WidthField }
	})
	export default class EditType extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();

		@Ref() typeValidationProvider?: InstanceType<typeof ValidationProvider>;

		@Prop({ type: String, required: true }) id!: string;
		@Prop({ type: IdType }) typeId?: ID;

		type: Type & TypeUpdate = null as any;
		isSaving = false;
		editField: Field | null = null;

		setTimeout(func: () => void): void {
			setTimeout(func, 0);
		}

		initialize(): void {
			this.type = clone(this.initialType);
		}

		clear(): void {
			this.type = null as any;
		}

		get initialType(): Type & TypeUpdate {
			const type = this.isCreate ? { fields: [] } as any : clone(this.originalType)!;

			for(const field of type.fields) {
				field.oldName = field.name;
			}

			return type;
		}

		get isModified(): boolean {
			return !isEqual(this.type, this.initialType);
		}

		get isCreate(): boolean {
			return this.typeId == null;
		}

		get originalType(): Type | undefined {
			return this.typeId != null ? this.client.types[this.typeId] : undefined;
		}

		get canControl(): Array<keyof Marker | keyof Line> {
			return canControl(this.type, null);
		}

		@Watch("originalType")
		handleChangeType(newType: Type | undefined, oldType: Type): void {
			if (this.type) {
				if (!newType) {
					this.$bvModal.hide(this.id);
					// TODO: Show message
				} else {
					mergeTypeObject(oldType, newType, this.type);
				}
			}
		}

		@Watch("type", { deep: true })
		handleChange(type: TypeUpdate): void {
			this.typeValidationProvider?.validate({ ...type });
		}

		createField(): void {
			this.type.fields.push({ name: "", type: "input", "default": "" });
		}

		async deleteField(field: Field): Promise<void> {
			if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the field “${field.name}”?`))
				return;

			var idx = this.type.fields.indexOf(field);
			if(idx != -1)
				this.type.fields.splice(idx, 1);
		}

		async save(): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-edit-type-error`);
			this.isSaving = true;

			for (const prop of [ "defaultWidth", "defaultSize", "defaultColour" ] as Array<"defaultWidth" | "defaultSize" | "defaultColour">) {
				if(this.type[prop] == "")
					this.type[prop] = null;
			}

			try {
				if (this.isCreate)
					await this.client.addType(this.type);
				else
					await this.client.editType(this.type);

				this.$bvModal.hide(this.id);
			} catch (err) {
				toasts.showErrorToast(this, `fm${this.context.id}-edit-type-error`, this.isCreate ? "Error creating type" : "Error saving type", err);
			} finally {
				this.isSaving = false;
			}
		}

		editDropdown(field: Field): void {
			this.editField = field;
			setTimeout(() => { this.$bvModal.show(`${this.id}-dropdown`); }, 0);
		}

	}

</script>

<template>
	<FormModal
		:id="id"
		title="Edit Type"
		class="fm-edit-type"
		:is-saving="isSaving"
		:is-modified="isModified"
		:is-create="isCreate"
		@submit="$event.waitUntil(save)"
		@hidden="clear"
		@show="initialize"
	>
		<template v-if="type">
			<ValidationProvider name="Name" v-slot="v" rules="required">
				<div class="row mb-3">
					<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
					<div class="col-sm-9">
						<input class="form-control" :id="`${id}-name-input`" v-model="type.name" :state="v | validationState" />
						<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
					</div>
				</div>
			</ValidationProvider>

			<ValidationProvider name="Type" v-slot="v" rules="required">
				<div class="row mb-3">
					<label :for="`${id}-type-input`" class="col-sm-3 col-form-label">Type</label>
					<div class="col-sm-9">
						<select
							:id="`${id}-type-input`"
							v-model="type.type"
							class="form-select"
							:disabled="!isCreate"
							:state="v | validationState"
						>
							<option value="marker">Marker</option>
							<option value="line">Line</option>
						</select>
						<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
					</div>
				</div>
			</ValidationProvider>

			<template v-if="canControl.length > 0">
				<hr/>

				<p class="text-muted">
					These styles are applied when a new object of this type is created. If “Fixed” is enabled, the style is applied to all objects
					of this type and cannot be changed for an individual object anymore. For more complex style control, dropdown or checkbox fields
					can be configured below to change the style based on their selected value.
				</p>

				<ValidationProvider v-if="canControl.includes('colour')" name="Default colour" v-slot="v" :rules="type.colourFixed ? 'required|colour' : 'colour'">
					<div class="row mb-3">
						<label :for="`${id}-default-colour-input`" class="col-sm-3 col-form-label">Default colour</label>
						<div class="col-sm-9">
							<div class="row align-items-center">
								<div class="col-sm-9">
									<ColourField :id="`${id}-default-colour-input`" v-model="type.defaultColour" :state="v | validationState"></ColourField>
								</div>
								<div class="col-sm-3">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-colour-fixed`"
										v-model="type.colourFixed"
										@update="setTimeout(() => { v.validate(type.defaultColour); })"
									/>
									<label :for="`${id}-default-colour-fixed`" class="form-check-label">Fixed</label>
								</div>
							</div>
							<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
						</div>
					</div>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('size')" name="Default size" v-slot="v" :rules="type.sizeFixed ? 'required|size' : 'size'">
					<div class="row mb-3">
						<label :for="`${id}-default-size-input`" class="col-sm-3 col-form-label">Default size</label>
						<div class="col-sm-9">
							<div class="row align-items-center">
								<div class="col-sm-9">
									<SizeField :id="`${id}-default-size-input`" v-model="type.defaultSize" :state="v | validationState"></SizeField>
								</div>
								<div class="col-sm-3">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-size-fixed`"
										v-model="type.sizeFixed"
										@update="setTimeout(() => { v.validate(type.defaultSize); })"
									/>
									<label :for="`${id}-default-size-fixed`" class="form-check-label">Fixed</label>
								</div>
							</div>
							<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
						</div>
					</div>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('symbol')" name="Default icon" v-slot="v" rules="symbol">
					<div class="row mb-3">
						<label :for="`${id}-default-symbol-input`" class="col-sm-3 col-form-label">Default icon</label>
						<div class="col-sm-9">
							<div class="row align-items-center">
								<div class="col-sm-9">
									<SymbolField :id="`${id}-default-symbol-input`" v-model="type.defaultSymbol" :state="v | validationState"></SymbolField>
								</div>
								<div class="col-sm-3">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-symbol-fixed`"
										v-model="type.symbolFixed"
										@update="setTimeout(() => { v.validate(type.defaultSymbol); })"
									/>
									<label :for="`${id}-default-symbol-fixed`" class="form-check-label">Fixed</label>
								</div>
							</div>
							<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
						</div>
					</div>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('shape')" name="Default shape" v-slot="v" rules="shape">
					<div class="row mb-3">
						<label :for="`${id}-default-shape-input`" class="col-sm-3 col-form-label">Default shape</label>
						<div class="col-sm-9">
							<div class="row align-items-center">
								<div class="col-sm-9">
									<ShapeField :id="`${id}-default-shape-input`" v-model="type.defaultShape" :state="v | validationState"></ShapeField>
								</div>
								<div class="col-sm-3">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-shape-fixed`"
										v-model="type.shapeFixed"
										@update="setTimeout(() => { v.validate(type.defaultShape); })"
									/>
									<label :for="`${id}-default-shape-fixed`" class="form-check-label">Fixed</label>
								</div>
							</div>
							<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
						</div>
					</div>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('width')" name="Default width" v-slot="v" :rules="type.widthFixed ? 'required|width' : 'width'">
					<div class="row mb-3">
						<label :for="`${id}-default-width-input`" class="col-sm-3 col-form-label">Default width</label>
						<div class="col-sm-9">
							<div class="row align-items-center">
								<div class="col-sm-9">
									<WidthField :id="`${id}-default-width-input`" v-model="type.defaultWidth" :state="v | validationState"></WidthField>
								</div>
								<div class="col-sm-3">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-width-fixed`"
										v-model="type.widthFixed"
										@update="setTimeout(() => { v.validate(type.defaultWidth); })"
									/>
									<label :for="`${id}-default-width-fixed`" class="form-check-label">Fixed</label>
								</div>
							</div>
							<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
						</div>
					</div>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('mode')" name="Default routing mode" v-slot="v" :rules="type.modeFixed ? 'required' : ''">
					<div class="row mb-3">
						<label :for="`${id}-default-mode-input`" class="col-sm-3 col-form-label">Default routing mode</label>
						<div class="col-sm-9">
							<div class="row align-items-center">
								<div class="col-sm-9">
									<RouteMode :id="`${id}-default-mode-input`" v-model="type.defaultMode" min="1"></RouteMode>
								</div>
								<div class="col-sm-3">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-mode-fixed`"
										v-model="type.modeFixed"
										@update="setTimeout(() => { v.validate(type.defaultMode); })"
									/>
									<label :for="`${id}-default-mode-fixed`" class="form-check-label">Fixed</label>
								</div>
							</div>
							<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
						</div>
					</div>
				</ValidationProvider>

				<hr/>
			</template>

			<div class="row mb-3">
				<label :for="`${id}-show-in-legend-input`" class="col-sm-3 col-form-label">Legend</label>
				<div class="col-sm-9">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-in-legend-input`"
						v-model="type.showInLegend"
					/>
					<label :for="`${id}-show-in-legend-input`" class="form-check-label">Show in legend</label>
					<div class="form-text">
						An item for this type will be shown in the legend. Any fixed style attributes are applied to it. Dropdown or checkbox fields that control the style generate additional legend items.
					</div>
				</div>
			</div>

			<h2>Fields</h2>
			<div class="table-responseive">
				<table class="table table-hover table-striped">
					<thead>
						<tr>
							<th style="width: 35%; min-width: 150px">Name</th>
							<th style="width: 35%; min-width: 120px">Type</th>
							<th style="width: 35%; min-width: 150px">Default value</th>
							<th>Delete</th>
							<th></th>
						</tr>
					</thead>
					<draggable v-model="type.fields" tag="tbody" handle=".fm-drag-handle">
						<tr v-for="field in type.fields">
							<td>
								<ValidationProvider :name="`Field name (${field.name})`" v-slot="v" rules="required|uniqueFieldName:@type">
									<input class="form-control" v-model="field.name" :state="v | validationState" />
									<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
								</ValidationProvider>
							</td>
							<td>
								<div class="input-group">
									<select class="form-select" v-model="field.type">
										<option value="input">Text field</option>
										<option value="textarea">Text area</option>
										<option value="dropdown">Dropdown</option>
										<option value="checkbox">Checkbox</option>
									</select>
									<template v-if="['dropdown', 'checkbox'].includes(field.type)">
										<button type="button" class="btn btn-light" @click="editDropdown(field)">Edit</button>
									</template>
								</div>
							</td>
							<td class="text-center">
								<FieldInput :field="field" v-model="field.default" ignore-default></FieldInput>
							</td>
							<td class="td-buttons">
								<button type="button" class="btn btn-light" @click="deleteField(field)">Delete</button>
							</td>
							<td class="td-buttons">
								<button type="button" class="btn btn-light fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></button>
							</td>
						</tr>
					</draggable>
					<tfoot>
						<tr>
							<td colspan="4">
								<button type="button" class="btn btn-light" @click="createField()"><Icon icon="plus" alt="Add"></Icon></button>
							</td>
							<td class="move"></td>
						</tr>
					</tfoot>
				</table>
			</div>

			<ValidationProvider vid="type" ref="typeValidationProvider" v-slot="v" rules="" immediate>
				<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
			</ValidationProvider>

			<EditTypeDropdown v-if="editField != null" :id="`${id}-dropdown`" :type="type" :field="editField"></EditTypeDropdown>
		</template>
	</FormModal>
</template>