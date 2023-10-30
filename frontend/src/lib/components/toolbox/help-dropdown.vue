<script setup lang="ts">
	import AboutDialog from "../about-dialog.vue";
	import { ref } from "vue";

	const emit = defineEmits<{
		(type: "hide-sidebar"): void;
	}>();

	const dialog = ref<
		| "about"
	>();
</script>

<template>
	<li class="nav-item dropdown">
		<a
			class="nav-link dropdown-toggle"
			href="javascript:"
			data-bs-toggle="dropdown"
		>Help</a>
		<ul class="dropdown-menu dropdown-menu-end">
			<li>
				<a
					class="dropdown-item"
					href="https://docs.facilmap.org/users/"
					target="_blank"
				>Documentation</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					href="https://matrix.to/#/#facilmap:rankenste.in"
					target="_blank"
				>Matrix chat room</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					href="https://github.com/FacilMap/facilmap/issues"
					target="_blank"
				>Report a problem</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					href="https://github.com/FacilMap/facilmap/discussions"
					target="_blank"
				>Ask a question</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					@click="dialog = 'about'; emit('hide-sidebar')"
					href="javascript:"
				>About FacilMap</a>
			</li>
		</ul>
	</li>

	<AboutDialog
		v-if="dialog === 'about'"
		@hidden="dialog = undefined"
	></AboutDialog>
</template>