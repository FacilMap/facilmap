<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.css";
	import { FacilMap } from "../lib";
	import { ref } from "vue";

	const serverUrl = "http://localhost:40829/";
	const padId1 = ref("test");
	const padName1 = ref<string>();
	const padId2 = ref("test");
	const padName2 = ref<string>();

	const map1Ref = ref<InstanceType<typeof FacilMap>>();
	const map2Ref = ref<InstanceType<typeof FacilMap>>();
</script>

<template>
	<div>
		<FacilMap
			:baseUrl="serverUrl"
			:serverUrl="serverUrl"
			v-model:padId="padId1"
			@update:padName="padName1 = $event"
			ref="map1Ref"
		>
			<template #before>
				<div>{{padId1}} | {{padName1}}</div>
				<div>
					#{{map1Ref?.context?.components.map?.hash}}
				</div>
			</template>
		</FacilMap>

		<FacilMap
			:baseUrl="serverUrl"
			:serverUrl="serverUrl"
			v-model:padId="padId2"
			@update:padName="padName2 = $event"
			ref="map2Ref"
		>
			<template #before>
				<div>{{padId2}} | {{padName2}}</div>
				<div>
					#{{map2Ref?.context?.components.map?.hash}}
				</div>
			</template>
		</FacilMap>
	</div>
</template>