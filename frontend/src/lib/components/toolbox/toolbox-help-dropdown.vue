<script setup lang="ts">
	import AboutDialog from "../about-dialog.vue";
	import { ref } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import Icon from "../ui/icon.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const i18n = useI18n();

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
		:label="i18n.t('toolbox-help-dropdown.label')"
	>
		<li>
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				href="https://docs.facilmap.org/users/"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-help-dropdown.documentation")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>

		<li>
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				href="https://matrix.to/#/#facilmap:rankenste.in"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-help-dropdown.matrix-chat")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>

		<li>
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				href="https://github.com/FacilMap/facilmap/issues"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-help-dropdown.bugtracker")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>

		<li>
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				href="https://github.com/FacilMap/facilmap/discussions"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-help-dropdown.forum")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>

		<li>
			<a
				class="dropdown-item"
				@click="dialog = 'about'; emit('hide-sidebar')"
				href="javascript:"
				draggable="false"
			>{{i18n.t("toolbox-help-dropdown.about", { appName: context.appName })}}</a>
		</li>
	</DropdownMenu>

	<AboutDialog
		v-if="dialog === 'about'"
		@hidden="dialog = undefined"
	></AboutDialog>
</template>