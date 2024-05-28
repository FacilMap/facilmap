<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.css";
	import { FacilMap } from "../lib";
	import { ref } from "vue";

	const serverUrl = "http://localhost:40829/";
	const mapSlug1 = ref("test");
	const mapName1 = ref<string>();
	const mapSlug2 = ref("test");
	const mapName2 = ref<string>();

	const map1Ref = ref<InstanceType<typeof FacilMap>>();
	const map2Ref = ref<InstanceType<typeof FacilMap>>();
</script>

<template>
	<FacilMap
		:baseUrl="serverUrl"
		:serverUrl="serverUrl"
		v-model:mapSlug="mapSlug1"
		@update:mapName="mapName1 = $event"
		ref="map1Ref"
	>
		<template #before>
			<div>{{mapSlug1}} | {{mapName1}}</div>
			<div>
				#{{map1Ref?.context?.components.map?.hash}}
			</div>
		</template>
	</FacilMap>

	<FacilMap
		:baseUrl="serverUrl"
		:serverUrl="serverUrl"
		v-model:mapSlug="mapSlug2"
		@update:mapName="mapName2 = $event"
		ref="map2Ref"
	>
		<template #before>
			<div>{{mapSlug2}} | {{mapName2}}</div>
			<div>
				#{{map2Ref?.context?.components.map?.hash}}
			</div>
		</template>
	</FacilMap>
</template>