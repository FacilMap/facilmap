<script setup lang="ts">
	import AboutDialog from "../about-dialog.vue";
	import { ref } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const dialog = ref<
		| "about"
	>();
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item"
		isLink
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		label="Help"
	>
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
	</DropdownMenu>

	<AboutDialog
		v-if="dialog === 'about'"
		@hidden="dialog = undefined"
	></AboutDialog>
</template>