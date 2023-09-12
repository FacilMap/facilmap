<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.css";
	import "bootstrap-vue/dist/bootstrap-vue.css";
	import { FacilMap } from "../lib";
	import MapControl from "./map-control.vue";

	const serverUrl = "http://localhost:40829/";
	const padId1 = "test";
	const padName1 = undefined;
	const padId2 = "test";
	const padName2 = undefined;
</script>

<template>
	<div>
		<FacilMap :base-url="serverUrl" :server-url="serverUrl" :pad-id.sync="padId1" @update:padName="padName1 = $event">
			<template #before>
				<div>{{padId1}} | {{padName2}}</div>
				<MapControl></MapControl>
			</template>
		</FacilMap>

		<FacilMap :base-url="serverUrl" :server-url="serverUrl" :pad-id.sync="padId2" @update:padName="padName2 = $event">
			<template #before>
				<div>{{padId2}} | {{padName2}}</div>
				<MapControl></MapControl>
			</template>
		</FacilMap>
	</div>
</template>