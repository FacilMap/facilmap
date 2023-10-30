<script setup lang="ts">
	import WithRender from "./edit-line.vue";
	import Vue from "vue";
	import { ID, Line, Type } from "facilmap-types";
	import { Client, InjectClient, InjectContext } from "../../utils/decorators";
	import { Component, Prop, Watch } from "vue-property-decorator";
	import { canControl, IdType, mergeObject } from "../../utils/utils";
	import { clone } from "facilmap-utils";
	import { isEqual, omit } from "lodash-es";
	import { showErrorToast } from "../../utils/toasts";
	import FormModal from "../ui/modal/modal";
	import { ValidationProvider } from "vee-validate";
	import ColourField from "../ui/colour-field/colour-field";
	import SymbolField from "../ui/symbol-field/symbol-field";
	import ShapeField from "../ui/shape-field/shape-field";
	import FieldInput from "../ui/field-input/field-input";
	import RouteMode from "../ui/route-mode/route-mode";
	import WidthField from "../ui/width-field/width-field";
	import StringMap from "../../utils/string-map";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { ColourField, FieldInput, FormModal, RouteMode, ShapeField, SymbolField, ValidationProvider, WidthField }
	})
	export default class EditLine extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();

		@Prop({ type: String, required: true }) id!: string;
		@Prop({ type: IdType, required: true }) lineId!: ID;

		line: Line<StringMap> = null as any;
		isSaving = false;

		initialize(): void {
			this.line = clone(this.client.lines[this.lineId]);
		}

		clear(): void {
			this.line = null as any;
		}

		get isModified(): boolean {
			return !isEqual(this.line, this.client.lines[this.lineId]);
		}

		get originalLine(): Line<StringMap> | undefined {
			return this.client.lines[this.lineId];
		}

		get types(): Type[] {
			return Object.values(this.client.types).filter((type) => type.type === "line");
		}

		get canControl(): Array<keyof Line> {
			return canControl(this.client.types[this.line.typeId]);
		}

		@Watch("originalLine")
		handleChangeLine(newLine: Line<StringMap> | undefined, oldLine: Line<StringMap>): void {
			if (this.line) {
				if (!newLine) {
					this.$bvModal.hide(this.id);
					// TODO: Show message
				} else {
					mergeObject(oldLine, newLine, this.line);
				}
			}
		}

		async save(): Promise<void> {
			this.isSaving = true;
			this.$bvToast.hide(`fm${this.context.id}-edit-line-error`);

			try {
				await this.client.editLine(omit(this.line, "trackPoints"));
				this.$bvModal.hide(this.id);
			} catch (err) {
				toasts.showErrorToast(this, `fm${this.context.id}-edit-line-error`, "Error saving line", err);
			} finally {
				this.isSaving = false;
			}
		}


	}
</script>

<template>
	<FormModal
		:id="id"
		title="Edit Line"
		class="fm-edit-line"
		:is-saving="isSaving"
		:is-modified="isModified"
		@submit="$event.waitUntil(save())"
		@hidden="clear"
		@show="initialize"
	>
		<template v-if="line">
			<div class="row mb-3">
				<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
				<div class="col-sm-9">
					<input class="form-control" :id="`${id}-name-input`" v-model="line.name" />
				</div>
			</div>

			<div v-if="canControl.includes('mode') && line.mode !== 'track'" class="row mb-3">
				<label class="col-sm-3 col-form-label">Routing mode</label>
				<div class="col-sm-9">
					<RouteMode v-model="line.mode"></RouteMode>
				</div>
			</div>

			<ValidationProvider v-if="canControl.includes('colour')" name="Colour" v-slot="v" rules="required|colour">
				<div class="row mb-3">
					<label :for="`${id}-colour-input`" class="col-sm-3 col-form-label">Colour</label>
					<div class="col-sm-9">
						<ColourField :id="`${id}-colour-input`" v-model="line.colour" :state="v | validationState"></ColourField>
						<div class="invalid-feedback" v-if="v.errors[0]"><span v-html="v.errors[0]"></span></div>
					</div>
				</div>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('width')" name="Width" v-slot="v" rules="width">
				<div class="row mb-3">
					<label :for="`${id}-width-input`" class="col-sm-3 col-form-label">Width</label>
					<div class="col-sm-9">
						<WidthField :id="`${id}-width-input`" v-model="line.width"></WidthField>
					</div>
				</div>
			</ValidationProvider>

			<template v-for="(field, idx) in client.types[line.typeId].fields">
				<div class="row mb-3" :key="field.name">
					<label :for="`${id}-${idx}-input`" class="col-sm-3 col-form-label">{{field.name}}</label>
					<div class="col-sm-9">
						<FieldInput :id="`${id}-${idx}-input`" :field="field" :value="line.data.get(field.name)" @input="line.data.set(field.name, $event)"></FieldInput>
					</div>
				</div>
			</template>
		</template>

		<template #footer-left>
			<div v-if="types.length > 1" class="dropup">
				<button type="button" class="btn btn-light dropdown-toggle">Change type</button>
				<ul class="dropdown-menu">
					<template v-for="type in types">
						<li>
							<a
								href="javascript:"
								class="dropdown-item"
								:class="{ active: type.id == line.typeId }"
								@click="line.typeId = type.id"
							>{{type.name}}</a>
						</li>
					</template>
				</ul>
			</div>
		</template>
	</FormModal>
</template>