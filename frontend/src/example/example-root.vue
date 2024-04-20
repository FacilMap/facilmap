<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.css";
	import { FacilMap } from "../lib";
	import { ref } from "vue";

	const serverUrl = "http://localhost:40829/";
	const mapId1 = ref("test");
	const mapName1 = ref<string>();
	const mapId2 = ref("test");
	const mapName2 = ref<string>();

	const map1Ref = ref<InstanceType<typeof FacilMap>>();
	const map2Ref = ref<InstanceType<typeof FacilMap>>();
</script>

<template>
	<FacilMap
		:baseUrl="serverUrl"
		:serverUrl="serverUrl"
		v-model:mapId="mapId1"
		@update:mapName="mapName1 = $event"
		ref="map1Ref"
	>
		<template #before>
			<div>{{mapId1}} | {{mapName1}}</div>
			<div>
				#{{map1Ref?.context?.components.map?.hash}}
			</div>
		</template>
	</FacilMap>

	<FacilMap
		:baseUrl="serverUrl"
		:serverUrl="serverUrl"
		v-model:mapId="mapId2"
		@update:mapName="mapName2 = $event"
		ref="map2Ref"
	>
		<template #before>
			<div>{{mapId2}} | {{mapName2}}</div>
			<div>
				#{{map2Ref?.context?.components.map?.hash}}
			</div>
		</template>
	</FacilMap>
</template>