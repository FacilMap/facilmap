<FormModal
	:id="id"
	title="Filter"
	dialog-class="fm-edit-filter"
	:is-modified="isModified"
	@submit="save"
	@show="initialize"
	ok-title="Apply"
>
	<template v-if="filter != null">
		<p>Here you can set an advanced expression to show/hide certain markers/lines based on their attributes. The filter expression only applies to your view of the map, but it can be persisted as part of a saved view or a shared link.</p>

		<ValidationProvider name="Filter" v-slot="v" rules="filter">
			<b-form-group :state="v | validationState(true)">
				<b-textarea v-model="filter" rows="5" :state="v | validationState(true)" class="text-monospace"></b-textarea>
				<template #invalid-feedback><pre v-html="v.errors[0]"></pre></template>
			</b-form-group>
		</ValidationProvider>

		<hr />

		<div class="fm-edit-filter-syntax">
			<h3>Syntax</h3>
			<table class="table table-condensed table-striped">
				<thead>
					<tr>
						<th>Variable</th>
						<th>Description</th>
						<th>Example</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>name</code></td>
						<td>Marker/Line name</td>
						<td><code>name == "Berlin"</code></td>
					</tr>

					<tr>
						<td><code>type</code></td>
						<td><code>marker</code> / <code>line</code></td>
						<td><code>type == "marker"</code></td>
					</tr>

					<tr>
						<td><code>typeId</code></td>
						<td><span v-for="(type, idx) in types"><span v-if="idx != 0"> / </span> <code>{{type.id}}</code> ({{type.name}})</span></td>
						<td><code>typeId == {{types[0].id || 1}}</code></td>
					</tr>

					<tr>
						<td><code>data.&lt;field&gt;</code> / <code>prop(data, &lt;field&gt;)</code></td>
						<td>Field values (example: <code>data.Description</code> or <code>prop(data, &quot;Description&quot;)</code></td>
						<td><code>lower(data.Description) ~= &quot;camp&quot;</code></td>
					</tr>

					<tr>
						<td><code>lat</code>, <code>lon</code></td>
						<td>Marker coordinates</td>
						<td><code>lat &lt; 50</code></td>
					</tr>

					<tr>
						<td><code>colour</code></td>
						<td>Marker/line colour</td>
						<td><code>colour == &quot;ff0000&quot;</code></td>
					</tr>

					<tr>
						<td><code>size</code></td>
						<td>Marker size</td>
						<td><code>size &gt; 30</code></td>
					</tr>

					<tr>
						<td><code>symbol</code></td>
						<td>Marker icon</td>
						<td><code>symbol == &quot;accommodation_camping&quot;</code></td>
					</tr>

					<tr>
						<td><code>shape</code></td>
						<td>Marker shape</td>
						<td><code>shape == &quot;circle&quot;</code></td>
					</tr>

					<tr>
						<td><code>ele</code></td>
						<td>Marker elevation</td>
						<td><code>ele &gt; 500</code></td>
					</tr>

					<tr>
						<td><code>mode</code></td>
						<td>Line routing mode (<code>""</code> / <code>"car"</code> / <code>"bicycle"</code> / <code>"pedestrian"</code> / <code>"track"</code>)</td>
						<td><code>mode in (&quot;bicycle&quot;, &quot;pedestrian&quot;)</code></td>
					</tr>

					<tr>
						<td><code>width</code></td>
						<td>Line width</td>
						<td><code>width &gt; 10</code></td>
					</tr>

					<tr>
						<td><code>distance</code></td>
						<td>Line distance in kilometers</td>
						<td><code>distance &lt; 50</code></td>
					</tr>

					<tr>
						<td><code>time</code></td>
						<td>Line routing time in seconds</td>
						<td><code>time &gt; 3600</code></td>
					</tr>

					<tr>
						<td><code>ascent</code>, <code>descent</code></td>
						<td>Total ascent/descent of line</td>
						<td><code>ascent &gt; 1000</code></td>
					</tr>

					<tr>
						<td><code>routePoints</code></td>
						<td>Line point coordinates</td>
						<td><code>routePoints.0.lon &gt; 60 and routePoints.2.lat &lt; 50</code></td>
					</tr>

					<tr>
						<th>Operator</th>
						<th>Description</th>
						<th>Example</th>
					</tr>

					<tr>
						<td><code>number</code></td>
						<td>Numerical value</td>
						<td><code>distance &lt; 1.5</code></td>
					</tr>

					<tr>
						<td><code>"text"</code></td>
						<td>Text value</td>
						<td><code>name == &quot;Athens&quot;</code></td>
					</tr>

					<tr>
						<td><code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>%</code>, <code>^</code></td>
						<td>Mathematical operations (<code>%</code>: modulo, <code>^</code>: power)</td>
						<td><code>distance / time &gt; 30</code></td>
					</tr>

					<tr>
						<td><code>and</code>, <code>or</code>, <code>not</code>, <code>()</code></td>
						<td>Logical operators</td>
						<td><code>not (size&gt;10) or (type==&quot;line&quot; and length&lt;=10)</code></td>
					</tr>

					<tr>
						<td><code>? :</code></td>
						<td>if/then/else operator</td>
						<td><code>(type==&quot;marker&quot; ? size : width) &gt; 10</code></td>
					</tr>

					<tr>
						<td><code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code></td>
						<td>Comparison (<code>!=</code>: not equal) (case sensitive)</td>
						<td><code>type != &quot;marker&quot;</code></td>
					</tr>

					<tr>
						<td><code>in</code>, <code>not in</code></td>
						<td>List operator (case sensitive)</td>
						<td><code>typeId not in (1,2)</code></td>
					</tr>

					<tr>
						<td><code>~=</code></td>
						<td>Regular expression match (case sensitive)</td>
						<td><code>name ~= &quot;^[Cc]amp$&quot;</code></td>
					</tr>

					<tr>
						<td><code>lower()</code></td>
						<td>Convert to lower case</td>
						<td><code>lower(name) ~= &quot;untitled&quot;</code></td>
					</tr>

					<tr>
						<td><code>ceil()</code>, <code>floor()</code>, <code>round()</code></td>
						<td>Round (<code>ceil</code>: up, <code>floor</code>: down)</td>
						<td><code>floor(distance/100) == 5</code></td>
					</tr>

					<tr>
						<td><code>abs()</code>, <code>log()</code>, <code>sqrt()</code></td>
						<td>Mathematical functions</td>
						<td><code>abs(lat) &lt; 30</code></td>
					</tr>

					<tr>
						<td><code>min()</code>, <code>max()</code></td>
						<td>Smallest/highest value</td>
						<td><code>min(routePoints.0.lat,routePoints.1.lat) &lt; 50</code></td>
					</tr>
				</tbody>
			</table>
		</div>
	</template>
</FormModal>