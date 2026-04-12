<script setup lang="ts">
	import { onMounted, ref } from "vue";
	import { useModelWithFallback } from "../../utils/vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { applySwipeTransition, isSwipe, useDrag } from "../../utils/drag";

	const context = injectContextRequired();

	const innerSidebarRef = ref<HTMLElement>();

	const isMounted = ref(false);
	const teleportTargetRef = ref<HTMLElement>();
	onMounted(() => {
		isMounted.value = true;
	});

	const visibleModel = defineModel<boolean>("visible", { default: undefined });
	const sidebarVisible = useModelWithFallback(visibleModel, false);

	const drag = useDrag(innerSidebarRef, {
		onDrag: ({ deltaX }) => {
			Object.assign(innerSidebarRef.value!.style, {
				transform: `translateX(${Math.max(0, deltaX)}px)`,
				transition: "none"
			});
		},

		onDragEnd: ({ deltaX, velocityX }) => {
			innerSidebarRef.value!.style.transition = "";

			const swiped = isSwipe({ size: innerSidebarRef.value!.offsetWidth, delta: deltaX, velocity: velocityX });
			const distance = swiped ? innerSidebarRef.value!.offsetWidth - Math.max(0, deltaX) : Math.max(0, deltaX);
			void applySwipeTransition(innerSidebarRef.value!, { distance, duration: 300, velocity: velocityX });

			innerSidebarRef.value!.style.transform = "";

			if (swiped) {
				sidebarVisible.value = false;
			}
		}
	});

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
	<div class="fm-sidebar" :class="{ isNarrow: context.isNarrow, isDragging: drag.isDragging }">
		<template v-if="context.isNarrow">
			<div class="fm-sidebar-outer" @keydown="handleSidebarKeyDown" :class="{ show: sidebarVisible }">
				<div class="fm-sidebar-backdrop bg-dark" @click="handleBackdropClick"></div>
				<div class="fm-sidebar-inner bg-body" ref="innerSidebarRef" :class="{ shadow: sidebarVisible }">
					<nav class="navbar">
						<div class="container-fluid" :ref="(el) => { if (el) { teleportTargetRef = el as any; } }"></div>
					</nav>
					<div class="fm-sidebar-footer">
						<slot name="narrow-footer"></slot>
					</div>
				</div>
			</div>
		</template>

		<nav v-if="!context.isNarrow" class="navbar navbar-expand bg-body-tertiary">
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
			touch-action: pan-y !important;
			transform: translateX(100%);
			transition: transform 0.3s, box-shadow 0.3s;
			padding: var(--facilmap-inset-top, 0px) var(--facilmap-inset-right, 0px) var(--facilmap-inset-bottom, 0px) 0;

			> .navbar {
				display: flex;
				flex-direction: column;
				flex-grow: 1;
			}
		}

		.fm-sidebar-outer.show .fm-sidebar-inner {
			transform: translateX(0);
		}

		&.isNarrow {
			&, .dropdown-menu {
				font-size: 14px;
			}

			.dropdown-menu {
				overflow: visible;
			}
		}

	}
</style>