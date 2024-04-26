<script setup lang="ts">
	import hammer from "hammerjs";
	import { onMounted, ref, watchEffect } from "vue";
	import { useRefWithOverride } from "../../utils/vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();

	const props = withDefaults(defineProps<{
		visible?: boolean;
	}>(), {
		visible: undefined
	});

	const emit = defineEmits<{
		"update:visible": [visible: boolean];
	}>();

	const isDragging = ref(false);

	const innerSidebarRef = ref<HTMLElement>();

	const isMounted = ref(false);
	const teleportTargetRef = ref<HTMLElement>();
	onMounted(() => {
		isMounted.value = true;
	});

	const sidebarVisible = useRefWithOverride(false, () => props.visible, (visible) => {
		emit("update:visible", visible);
	});

	watchEffect((onCleanup) => {
		if (innerSidebarRef.value) {
			const pan = new hammer.Manager(innerSidebarRef.value);
			pan.add(new hammer.Pan({ direction: hammer.DIRECTION_RIGHT }));
			pan.on("panstart", handleDragStart);
			pan.on("pan", handleDragMove);
			pan.on("panend", handleDragEnd);

			onCleanup(() => {
				pan.destroy();
			});
		}
	});

	function handleDragStart(): void {
		isDragging.value = true;
	}

	function handleDragMove(event: any): void {
		Object.assign(innerSidebarRef.value!.style, {
			transform: `translateX(${Math.max(0, event.deltaX)}px)`,
			transition: "none"
		});
	}

	function handleDragEnd(event: any): void {
		isDragging.value = false;

		Object.assign(innerSidebarRef.value!.style, {
			transform: "",
			transition: ""
		});

		if (event.velocityX > 0.3 || event.deltaX > innerSidebarRef.value!.offsetWidth / 2) {
			sidebarVisible.value = false;
		}
	}

	function handleSidebarKeyDown(event: KeyboardEvent): void {
		if (event.key === "Escape") {
			sidebarVisible.value = false;
		}
	}

	function handleBackdropClick(): void {
		sidebarVisible.value = false;
	}
</script>

<template>
	<div class="fm-sidebar" :class="{ isNarrow: context.isNarrow, isDragging }">
		<template v-if="context.isNarrow">
			<div class="fm-sidebar-outer" @keydown="handleSidebarKeyDown" :class="{ show: sidebarVisible }">
				<div class="fm-sidebar-backdrop bg-dark" @click="handleBackdropClick"></div>
				<div class="fm-sidebar-inner bg-body" ref="innerSidebarRef" :class="{ shadow: sidebarVisible }">
					<nav class="navbar">
						<div class="container-fluid" :ref="(el) => { if (el) { teleportTargetRef = el as any; } }"></div>
					</nav>
				</div>
			</div>
		</template>

		<nav v-if="!context.isNarrow" class="navbar navbar-expand bg-light">
			<div class="container-fluid" :ref="(el) => { if (el) { teleportTargetRef = el as any; } }"></div>
		</nav>

		<Teleport v-if="teleportTargetRef" :to="teleportTargetRef">
			<slot></slot>
		</Teleport>
	</div>
</template>

<style lang="scss">
	.fm-sidebar {

		&.isDragging .fm-sidebar-inner {
			cursor: grabbing;

			> * {
				// Prevent click event on drag end (see https://stackoverflow.com/a/59957886/242365)
				pointer-events: none;
			}
		}

		.navbar-toggler {
			position: absolute;
			top: 10px;
			right: 10px;
		}

		.fm-sidebar-outer {
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			z-index: 1035;
			pointer-events: none;

			&.show {
				pointer-events: auto;
			}
		}

		.fm-sidebar-backdrop {
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			z-index: -1;
			opacity: 0;
			transition: opacity 0.3s;
		}

		.fm-sidebar-outer.show .fm-sidebar-backdrop {
			opacity: 0.6;
		}

		.fm-sidebar-inner {
			display: flex;
			flex-direction: column;
			position: fixed;
			top: 0;
			right: 0;
			width: 320px;
			max-width: 80%;
			height: 100%;
			overflow: auto;
			touch-action: pan-y;
			transform: translateX(100%);
			transition: transform 0.3s, box-shadow 0.3s;
		}

		.fm-sidebar-outer.show .fm-sidebar-inner {
			transform: translateX(0);
		}

		&.isNarrow {
			&, .dropdown-menu {
				font-size: 14px;
			}
		}

	}
</style>