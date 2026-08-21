<script setup lang="ts">
	import { Editor, type ChainedCommands } from "@tiptap/vue-3";
	import DropdownMenu from "../dropdown-menu.vue";
	import Icon from "../icon.vue";
	import vTooltip from "../../../utils/tooltip";

	const props = defineProps<{
		editor: Editor;
		styles: MenuStyles;
	}>();

	export type MenuStyleDropdownItem = {
		label: string;
		icon?: string;
		toggle: (chain: ChainedCommands) => ChainedCommands | undefined;
		active: boolean;
		tag?: string;
		className?: string;
	};

	export type MenuStyleButton = {
		label?: string;
		icon?: string;
		toggle: (chain: ChainedCommands) => ChainedCommands | undefined;
		active?: boolean;
		style?: string;
		tooltip?: string;
	};

	export type MenuStyleDropdown = {
		label?: string;
		sections: Array<{
			heading?: string;
			items: MenuStyleDropdownItem[];
		}>;
		tooltip?: string;
	};

	export type MenuStyles = Array<Array<MenuStyleButton | MenuStyleDropdown>>;
</script>

<template>
	<!-- eslint-disable vue/require-v-for-key vue/valid-v-for -->
	<div class="fm-markdown-editor-menu-content btn-toolbar">
		<template v-for="styleGroup of styles">
			<div class="btn-group" role="group">
				<template v-for="style of styleGroup">
					<template v-if="'sections' in style">
						<DropdownMenu :label="style.label" class="btn-group" :tooltip="style.tooltip">
							<template v-for="(section, i) in style.sections">
								<li v-if="i > 0"><hr class="dropdown-divider"></li>
								<li v-if="section.heading"><h6 class="dropdown-header">{{section.heading}}</h6></li>
								<template v-for="item of section.items" :key="item.label">
									<li>
										<a
											href="javascript:"
											class="dropdown-item"
											@click="item.toggle(props.editor.chain().focus())?.run()"
											:class="{ active: item.active }"
										>
											<template v-if="item.icon">
												<Icon :icon="item.icon"></Icon>
											</template>
											<component :is="item.tag ?? 'span'" :class="item.className">
												{{item.label}}
											</component>
										</a>
									</li>
								</template>
							</template>
						</DropdownMenu>
					</template>
					<template v-else>
						<button
							type="button"
							@click="style.toggle(props.editor.chain().focus())?.run()"
							class="btn btn-secondary"
							:class="{ active: style.active }"
							:style="style.style"
							v-tooltip="style.tooltip"
						>
							<Icon v-if="style.icon" :icon="style.icon"></Icon>
							<template v-if="style.icon && style.label">{{" "}}</template>
							{{style.label}}
						</button>
					</template>
				</template>
			</div>
		</template>
		<!-- eslint-enable vue/require-v-for-key vue/valid-v-for -->
	</div>
</template>

<style lang="scss">
	.fm-markdown-editor-menu-content {
		.dropdown-item {
			display: flex;
			align-items: center;
			gap: 0.25rem;

			> * {
				margin: 0; // Reset heading margin
			}
		}
	}
</style>