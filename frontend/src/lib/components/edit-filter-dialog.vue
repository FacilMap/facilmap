<script setup lang="ts">
	import { filterHasError, getOrderedTypes } from "facilmap-utils";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { computed, ref } from "vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "./ui/validated-form/validated-field.vue";
	import { T, useI18n } from "../utils/i18n";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const modalRef = ref<InstanceType<typeof ModalDialog>>();
	const filter = ref(mapContext.value.filter ?? "");

	const types = computed(() => getOrderedTypes(client.value.types));

	function validateFilter(filter: string) {
		return filterHasError(filter)?.message;
	}

	const isModified = computed(() => {
		return filter.value != (mapContext.value.filter ?? "");
	});

	function save(): void {
		mapContext.value.components.map.setFmFilter(filter.value || undefined);
		modalRef.value?.modal.hide();
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('edit-filter-dialog.title')"
		class="fm-edit-filter"
		:isModified="isModified"
		@submit="save"
		:okLabel="isModified ? i18n.t('edit-filter-dialog.apply') : undefined"
		ref="modalRef"
		@hidden="emit('hidden')"
	>
		<p>{{i18n.t("edit-filter-dialog.introduction")}}</p>

		<ValidatedField
			:value="filter"
			:validators="[
				validateFilter
			]"
			:reportValid="!!filter"
			immediate
		>
			<template #default="slotProps">
				<textarea
					class="form-control text-monospace"
					v-model="filter"
					rows="5"
					:ref="slotProps.inputRef"
				></textarea>
				<div class="invalid-feedback" v-if="slotProps.validationError">
					<pre>{{slotProps.validationError}}</pre>
				</div>
			</template>
		</ValidatedField>

		<hr />

		<div class="fm-edit-filter-syntax">
			<h3>{{i18n.t("edit-filter-dialog.syntax-header")}}</h3>
			<table class="table table-condensed table-striped">
				<thead>
					<tr>
						<th>{{i18n.t("edit-filter-dialog.variable")}}</th>
						<th>{{i18n.t("edit-filter-dialog.description")}}</th>
						<th>{{i18n.t("edit-filter-dialog.example")}}</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>name</code></td>
						<td>{{i18n.t("edit-filter-dialog.name-description")}}</td>
						<td><code>name == &quot;Berlin&quot;</code></td>
					</tr>

					<tr>
						<td><code>type</code></td>
						<td>
							<T k="edit-filter-dialog.type-description">
								<template #marker>
									<code>marker</code>
								</template>
								<template #line>
									<code>line</code>
								</template>
							</T>
						</td>
						<td><code>type == &quot;marker&quot;</code></td>
					</tr>

					<tr>
						<td><code>typeId</code></td>
						<td>
							<T k="edit-filter-dialog.typeId-description">
								<template #items>
									<span v-for="(type, idx) in types" :key="type.id">
										<span v-if="idx != 0">{{i18n.t("edit-filter-dialog.typeId-description-separator")}}</span>
										<T k="edit-filter-dialog.typeId-description-item">
											<template #typeId>
												<code>{{type.id}}</code>
											</template>
											<template #typeName>
												<span class="text-break">{{type.name}}</span>
											</template>
										</T>
									</span>
								</template>
							</T>
						</td>
						<td><code>typeId == {{types[0]?.id || 1}}</code></td>
					</tr>

					<tr>
						<td><code>data.&lt;field&gt;</code> / <code>prop(data, &lt;field&gt;)</code></td>
						<td>
							<T k="edit-filter-dialog.data-description-1">
								<template #example1>
									<code>data.Description</code>
								</template>
								<template #example2>
									<code>prop(data, &quot;Description&quot;)</code>
								</template>
							</T>
							<br />
							<T k="edit-filter-dialog.data-description-2">
								<template #uncheckedValue>
									<code>0</code>
								</template>
								<template #checkedValue>
									<code>1</code>
								</template>
							</T>
						</td>
						<td><code>lower(data.Description) ~= &quot;camp&quot;</code></td>
					</tr>

					<tr>
						<td><code>lat</code>, <code>lon</code></td>
						<td>{{i18n.t("edit-filter-dialog.lon-lat-description")}}</td>
						<td><code>lat &lt; 50</code></td>
					</tr>

					<tr>
						<td><code>colour</code></td>
						<td>{{i18n.t("edit-filter-dialog.colour-description")}}</td>
						<td><code>colour == &quot;ff0000&quot;</code></td>
					</tr>

					<tr>
						<td><code>size</code></td>
						<td>{{i18n.t("edit-filter-dialog.size-description")}}</td>
						<td><code>size &gt; 30</code></td>
					</tr>

					<tr>
						<td><code>icon</code></td>
						<td>{{i18n.t("edit-filter-dialog.icon-description")}}</td>
						<td><code>icon == &quot;accommodation_camping&quot;</code></td>
					</tr>

					<tr>
						<td><code>shape</code></td>
						<td>{{i18n.t("edit-filter-dialog.shape-description")}}</td>
						<td><code>shape == &quot;circle&quot;</code></td>
					</tr>

					<tr>
						<td><code>ele</code></td>
						<td>{{i18n.t("edit-filter-dialog.ele-description")}}</td>
						<td><code>ele &gt; 500</code></td>
					</tr>

					<tr>
						<td><code>mode</code></td>
						<td>
							<T k="edit-filter-dialog.mode-description">
								<template #straight>
									<code>&quot;&quot;</code>
								</template>
								<template #car>
									<code>&quot;car&quot;</code>
								</template>
								<template #bicycle>
									<code>&quot;bicycle&quot;</code>
								</template>
								<template #pedestrian>
									<code>&quot;pedestrian&quot;</code>
								</template>
								<template #track>
									<code>&quot;track&quot;</code>
								</template>
							</T>
						</td>
						<td><code>mode in (&quot;bicycle&quot;, &quot;pedestrian&quot;)</code></td>
					</tr>

					<tr>
						<td><code>width</code></td>
						<td>{{i18n.t("edit-filter-dialog.width-description")}}</td>
						<td><code>width &gt; 10</code></td>
					</tr>

					<tr>
						<td><code>stroke</code></td>
						<td>
							<T k="edit-filter-dialog.stroke-description">
								<template #solid>
									<code>&quot;&quot;</code>
								</template>
								<template #dashed>
									<code>&quot;dashed&quot;</code>
								</template>
								<template #dotted>
									<code>&quot;dotted&quot;</code>
								</template>
							</T>
						</td>
						<td><code>shape == &quot;dotted&quot;</code></td>
					</tr>

					<tr>
						<td><code>distance</code></td>
						<td>{{i18n.t("edit-filter-dialog.distance-description")}}</td>
						<td><code>distance &lt; 50</code></td>
					</tr>

					<tr>
						<td><code>time</code></td>
						<td>{{i18n.t("edit-filter-dialog.time-description")}}</td>
						<td><code>time &gt; 3600</code></td>
					</tr>

					<tr>
						<td><code>ascent</code>, <code>descent</code></td>
						<td>{{i18n.t("edit-filter-dialog.ascent-descent-description")}}</td>
						<td><code>ascent &gt; 1000</code></td>
					</tr>

					<tr>
						<td><code>routePoints</code></td>
						<td>{{i18n.t("edit-filter-dialog.routePoints-description")}}</td>
						<td><code>routePoints.0.lon &gt; 60 and routePoints.2.lat &lt; 50</code></td>
					</tr>

					<tr>
						<th>{{i18n.t("edit-filter-dialog.operator")}}</th>
						<th>{{i18n.t("edit-filter-dialog.description")}}</th>
						<th>{{i18n.t("edit-filter-dialog.example")}}</th>
					</tr>

					<tr>
						<td><code>number</code></td>
						<td>{{i18n.t("edit-filter-dialog.number-description")}}</td>
						<td><code>distance &lt; 1.5</code></td>
					</tr>

					<tr>
						<td><code>"text"</code></td>
						<td>{{i18n.t("edit-filter-dialog.text-description")}}</td>
						<td><code>name == &quot;Athens&quot;</code></td>
					</tr>

					<tr>
						<td><code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>%</code>, <code>^</code></td>
						<td>
							<T k="edit-filter-dialog.mathematical-description">
								<template #plus>
									<code>+</code>
								</template>
								<template #minus>
									<code>-</code>
								</template>
								<template #times>
									<code>*</code>
								</template>
								<template #divided>
									<code>/</code>
								</template>
								<template #modulo>
									<code>%</code>
								</template>
								<template #power>
									<code>^</code>
								</template>
							</T>
						</td>
						<td><code>distance / time &gt; 30</code></td>
					</tr>

					<tr>
						<td><code>and</code>, <code>or</code>, <code>not</code>, <code>()</code></td>
						<td>{{i18n.t("edit-filter-dialog.logical-description")}}</td>
						<td><code>not (size&gt;10) or (type==&quot;line&quot; and length&lt;=10)</code></td>
					</tr>

					<tr>
						<td><code>? :</code></td>
						<td>{{i18n.t("edit-filter-dialog.ternary-description")}}</td>
						<td><code>(type==&quot;marker&quot; ? size : width) &gt; 10</code></td>
					</tr>

					<tr>
						<td><code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code></td>
						<td>
							<T k="edit-filter-dialog.comparison-description">
								<template #notEqual>
									<code>!=</code>
								</template>
							</T>
						</td>
						<td><code>type != &quot;marker&quot;</code></td>
					</tr>

					<tr>
						<td><code>in</code>, <code>not in</code></td>
						<td>
							<T k="edit-filter-dialog.list-description">
								<template #in>
									<code>in</code>
								</template>
								<template #notIn>
									<code>not in</code>
								</template>
							</T>
						</td>
						<td><code>typeId not in (1,2)</code></td>
					</tr>

					<tr>
						<td><code>~=</code></td>
						<td>{{i18n.t("edit-filter-dialog.regexp-description")}}</td>
						<td><code>name ~= &quot;^[Cc]amp$&quot;</code></td>
					</tr>

					<tr>
						<td><code>lower()</code></td>
						<td>{{i18n.t("edit-filter-dialog.lower-description")}}</td>
						<td><code>lower(name) ~= &quot;untitled&quot;</code></td>
					</tr>

					<tr>
						<td><code>ceil()</code>, <code>floor()</code>, <code>round()</code></td>
						<td>
							<T k="edit-filter-dialog.round-description">
								<template #round>
									<code>round</code>
								</template>
								<template #ceil>
									<code>ceil</code>
								</template>
								<template #floor>
									<code>floor</code>
								</template>
							</T>
						</td>
						<td><code>floor(distance/100) == 5</code></td>
					</tr>

					<tr>
						<td><code>abs()</code>, <code>log()</code>, <code>sqrt()</code></td>
						<td>
							<T k="edit-filter-dialog.functions-description">
								<template #abs>
									<code>abs</code>
								</template>
								<template #log>
									<code>log</code>
								</template>
								<template #sqrt>
									<code>sqrt</code>
								</template>
							</T>
						</td>
						<td><code>abs(lat) &lt; 30</code></td>
					</tr>

					<tr>
						<td><code>min()</code>, <code>max()</code></td>
						<td>
							<T k="edit-filter-dialog.min-max-description">
								<template #min>
									<code>min</code>
								</template>
								<template #max>
									<code>max</code>
								</template>
							</T>
						</td>
						<td><code>min(routePoints.0.lat,routePoints.1.lat) &lt; 50</code></td>
					</tr>
				</tbody>
			</table>
		</div>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-edit-filter {
		.modal-body.modal-body, form {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		hr {
			width: 100%;
		}

		.fm-edit-filter-syntax {
			overflow: auto;
			margin-right: -16px;
			padding-right: 16px;
			min-height: 150px;
			max-width: 100%;
		}

		pre {
			color: inherit;
			font-size: inherit;
		}
	}
</style>