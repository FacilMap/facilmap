<script setup lang="ts">
	import Vue, { defineComponent, ref } from "vue";
	import { BootstrapVue } from "bootstrap-vue";
	import "bootstrap/dist/css/bootstrap.css";
	import "bootstrap-vue/dist/bootstrap-vue.css";
	import withRender from "./example.vue";
	import { FacilMap } from "../lib";
	import MapControl from "./map-control";

	Vue.use(BootstrapVue);

	const Root = defineComponent({
		setup() {
			const serverUrl = "http://localhost:40829/";
			const padId1 = "test";
			const padName1 = undefined;
			const padId2 = "test";
			const padName2 = undefined;

			const persisted = ref(false);

			return () => h(Overview, {
				storage: reactiveLocalStorage,
				path: reactiveLocationHash.value,
				'onUpdate:path': (path) => {
					reactiveLocationHash.value = path;
				},
				'onUpdate:route': (route) => {
					if (!persisted.value && route.tab === "compose") {
						persisted.value = true;
						ensurePersistentStorage();
					}
				}
			});
		}
	});

	new Vue(withRender({
		el: "#app",
		data: {
			serverUrl: "http://localhost:40829/",
			padId1: "test",
			padName1: undefined,
			padId2: "test",
			padName2: undefined
		},
		components: { FacilMap, MapControl }
	}));
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