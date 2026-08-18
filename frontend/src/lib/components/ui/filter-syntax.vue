<script setup lang="ts">
	import { computed } from "vue";
	import { injectContextRequired, requireClientSub } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { getOrderedTypes } from "facilmap-utils";
	import { T, useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const clientSub = requireClientSub(context);

	const i18n = useI18n();

	const props = defineProps<{
		isFormula?: boolean;
	}>();

	const types = computed(() => getOrderedTypes(clientSub.value.data.types));
</script>

<template>
	<div class="fm-filter-syntax">
		<h3>{{i18n.t("filter-syntax.header")}}</h3>

		<table class="table table-condensed table-striped">
			<tbody>
				<tr>
					<th>{{i18n.t("filter-syntax.expression")}}</th>
					<th>{{i18n.t("filter-syntax.description")}}</th>
					<th>{{i18n.t("filter-syntax.example")}}</th>
				</tr>

				<tr>
					<td><code>&quot;text&quot;</code></td>
					<td>{{i18n.t("filter-syntax.text-description")}}</td>
					<td>
						<code v-if="props.isFormula">
							ceil(distance/60) + &quot; days&quot;
						</code>
						<code v-else>
							name == &quot;Athens&quot;
						</code>
					</td>
				</tr>

				<tr>
					<td>{{i18n.t("filter-syntax.number")}}</td>
					<td>{{i18n.t("filter-syntax.number-description")}}</td>
					<td>
						<code v-if="props.isFormula">
							distance / 60
						</code>
						<code v-else>
							distance &lt; 1.5
						</code>
					</td>
				</tr>

				<tr>
					<td><code>name</code></td>
					<td>{{i18n.t("filter-syntax.name-description")}}</td>
					<td>
						<code>
							name == &quot;Berlin&quot;
						</code>
					</td>
				</tr>

				<tr v-if="!props.isFormula">
					<td><code>type</code></td>
					<td>
						<T k="filter-syntax.type-description">
							<template #marker>
								<code>marker</code>
							</template>
							<template #line>
								<code>line</code>
							</template>
						</T>
					</td>
					<td>
						<code>
							type == &quot;marker&quot;
						</code>
					</td>
				</tr>

				<tr v-if="!props.isFormula">
					<td><code>typeId</code></td>
					<td>
						<T k="filter-syntax.typeId-description">
							<template #items>
								<span v-for="(type, idx) in types" :key="type.id">
									<span v-if="idx != 0">{{i18n.t("filter-syntax.typeId-description-separator")}}</span>
									<T k="filter-syntax.typeId-description-item">
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
					<td>
						<code>
							typeId == {{types[0]?.id || 1}}
						</code>
					</td>
				</tr>

				<tr>
					<td><code>data.&lt;field&gt;</code> / <code>prop(data, &lt;field&gt;)</code></td>
					<td>
						{{i18n.t("filter-syntax.data-description-1")}}
						<br />
						<T k="filter-syntax.data-description-2">
							<template #uncheckedValue>
								<code>&quot;0&quot;</code>
							</template>
							<template #checkedValue>
								<code>&quot;1&quot;</code>
							</template>
						</T>
					</td>
					<td>
						<template v-if="props.isFormula">
							<code>distance + 1*data.Add</code> /
							<br />
							<code>prop(data, &quot;My checkbox&quot;) == &quot;1&quot; ? 2 : 1</code>
						</template>
						<template v-else>
							<code>lower(data.Description) ~= &quot;camp&quot;</code> /
							<br />
							<code>prop(data, &quot;My checkbox&quot;) == &quot;1&quot;</code>
						</template>
					</td>
				</tr>

				<tr>
					<td><code>lat</code>, <code>lon</code></td>
					<td>{{i18n.t("filter-syntax.lon-lat-description")}}</td>
					<td>
						<code v-if="props.isFormula">
							lat + ", " + lon
						</code>
						<code v-else>
							lat &lt; 50
						</code>
					</td>
				</tr>

				<tr>
					<td><code>colour</code></td>
					<td>{{i18n.t("filter-syntax.colour-description")}}</td>
					<td><code>colour == &quot;ff0000&quot;</code></td>
				</tr>

				<tr>
					<td><code>size</code></td>
					<td>{{i18n.t("filter-syntax.size-description")}}</td>
					<td><code>size &gt; 30</code></td>
				</tr>

				<tr>
					<td><code>icon</code></td>
					<td>{{i18n.t("filter-syntax.icon-description")}}</td>
					<td><code>icon == &quot;accommodation_camping&quot;</code></td>
				</tr>

				<tr>
					<td><code>shape</code></td>
					<td>{{i18n.t("filter-syntax.shape-description")}}</td>
					<td><code>shape == &quot;circle&quot;</code></td>
				</tr>

				<tr>
					<td><code>ele</code></td>
					<td>{{i18n.t("filter-syntax.ele-description")}}</td>
					<td><code>ele &gt; 500</code></td>
				</tr>

				<tr>
					<td><code>mode</code></td>
					<td>
						<T k="filter-syntax.mode-description">
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
					<td>{{i18n.t("filter-syntax.width-description")}}</td>
					<td><code>width &gt; 10</code></td>
				</tr>

				<tr>
					<td><code>stroke</code></td>
					<td>
						<T k="filter-syntax.stroke-description">
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
					<td>{{i18n.t("filter-syntax.distance-description")}}</td>
					<td><code>(distance / 60) + &quot; days&quot;</code></td>
				</tr>

				<tr>
					<td><code>time</code></td>
					<td>{{i18n.t("filter-syntax.time-description")}}</td>
					<td><code>(time / 5 / 3600) + &quot; days&quot;</code></td>
				</tr>

				<tr>
					<td><code>ascent</code>, <code>descent</code></td>
					<td>{{i18n.t("filter-syntax.ascent-descent-description")}}</td>
					<td><code>(ascent / 400) + &quot;&#x202f;h&quot;</code></td>
				</tr>

				<tr v-if="props.isFormula">
					<td><code>routePoints</code></td>
					<td>{{i18n.t("filter-syntax.routePoints-description")}}</td>
					<td><code>routePoints.0.lon &gt; 60 and routePoints.2.lat &lt; 50</code></td>
				</tr>

				<tr>
					<th>{{i18n.t("filter-syntax.comparison")}}</th>
					<th>{{i18n.t("filter-syntax.description")}}</th>
					<th>{{i18n.t("filter-syntax.example")}}</th>
				</tr>

				<tr>
					<td><code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code></td>
					<td>
						<T k="filter-syntax.comparison-description">
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
						<T k="filter-syntax.list-description">
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
					<td>{{i18n.t("filter-syntax.regexp-description")}}</td>
					<td><code>name ~= &quot;^[Cc]amp$&quot;</code></td>
				</tr>

				<tr>
					<td><code>and</code>, <code>or</code>, <code>not</code>, <code>()</code></td>
					<td>{{i18n.t("filter-syntax.logical-description")}}</td>
					<td><code>not (size&gt;10) or (type==&quot;line&quot; and length&lt;=10)</code></td>
				</tr>

				<tr>
					<td><code>? :</code></td>
					<td>{{i18n.t("filter-syntax.ternary-description")}}</td>
					<td><code>(type==&quot;marker&quot; ? size : width) &gt; 10</code></td>
				</tr>

				<tr>
					<th>{{i18n.t("filter-syntax.operation")}}</th>
					<th>{{i18n.t("filter-syntax.description")}}</th>
					<th>{{i18n.t("filter-syntax.example")}}</th>
				</tr>

				<tr>
					<td><code>+</code></td>
					<td>
						{{i18n.t("filter-syntax.plus-description-1")}}
						<br />
						<T k="filter-syntax.plus-description-2">
							<template #code>
								<code>1*</code>
							</template>
						</T>
					</td>
					<td>
						<template v-if="props.isFormula">
							<code>(distance + ascent/20) + &quot;&#x202f;km&quot;</code> /
							<br />
							<code>distance + 1*data.Add</code>
						</template>
						<template v-else>
							<code>distance + ascent/20 > 2000</code> /
							<br />
							<code>distance + 1*data.Add > 100</code>
						</template>
					</td>
				</tr>

				<tr>
					<td><code>-</code>, <code>*</code>, <code>/</code>, <code>%</code>, <code>^</code></td>
					<td>
						<T k="filter-syntax.mathematical-description">
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
					<td><code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code></td>
					<td>
						<T k="filter-syntax.comparison-description">
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
						<T k="filter-syntax.list-description">
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
					<td>{{i18n.t("filter-syntax.regexp-description")}}</td>
					<td><code>name ~= &quot;^[Cc]amp$&quot;</code></td>
				</tr>

				<tr>
					<td><code>lower()</code></td>
					<td>{{i18n.t("filter-syntax.lower-description")}}</td>
					<td><code>lower(name) ~= &quot;untitled&quot;</code></td>
				</tr>

				<tr>
					<td><code>ceil()</code>, <code>floor()</code>, <code>round()</code></td>
					<td>
						<T k="filter-syntax.round-description">
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
						<T k="filter-syntax.functions-description">
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
						<T k="filter-syntax.min-max-description">
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
</template>