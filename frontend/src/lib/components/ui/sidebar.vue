<script setup lang="ts">
	import { onMounted, ref } from "vue";
	import { useRefWithOverride } from "../../utils/vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useDrag } from "../../utils/drag";

	const context = injectContextRequired();

	const props = defineProps<{
		id?: string;
	}>();

	const innerSidebarRef = ref<HTMLElement>();

	const isMounted = ref(false);
	const teleportTargetRef = ref<HTMLElement>();
	onMounted(() => {
		isMounted.value = true;
	});

	const visibleModel = defineModel<boolean>("visible");
	const sidebarVisible = useRefWithOverride(false, visibleModel);

	const drag = useDrag(innerSidebarRef, {
		onDrag: ({ deltaX }) => {
			Object.assign(innerSidebarRef.value!.style, {
				transform: `translateX(${Math.max(0, deltaX)}px)`,
				transition: "none"
			});
		},

		onDragEnd: ({ deltaX, velocityX }) => {
			Object.assign(innerSidebarRef.value!.style, {
				transform: "",
				transition: ""
			});

			if (velocityX > 0.3 || deltaX > innerSidebarRef.value!.offsetWidth / 2) {
				// If the dragging is happening with a high velocity and we then use the default CSS transition to close the sidebar,
				// the sliding of the sidebar does not feel smooth, since the initial velocity of the CSS animation might be slower
				// than the drag velocity.
				// The default easing function of a CSS transition is "ease", which is equivalent to cubic-bezier(0.25, 0.1, 0.25, 1).
				// Since x1 is 0.25 und y1 is 0.1, the initial speed is 0.1/0.25 = 0.4 (in the unit total distance / total time,
				// so in this case the number of pixels that the sidebar still needs to move divided by the transition time (300 ms)).
				// To avoid the perceived stutter in the animation, we try to adjust the initial speed of the transition to the speed
				// of the drag operation by adjusting x1.

				// Total distance of the transition (number of pixels that the sidebar has to move to slide out)
				const totalDistance = innerSidebarRef.value!.offsetWidth - Math.max(0, deltaX);
				// Total time in ms of the transition (defined below in the CSS)
				const totalTime = 300;
				// Convert px/ms velocity of the drag operation to the desired initial transition speed in the unit total distance / total time
				const speed = velocityX * totalTime / totalDistance;
				// x1 for the CSS easing function with the desired initial speed (y1 stays 0.1 as in the default)
				const x1 = 0.1 / speed;
				innerSidebarRef.value!.style.transitionTimingFunction = `cubic-bezier(${x1}, 0.1, 0.25, 1)`;

				const handleTransitionEnd = () => {
					innerSidebarRef.value!.style.transitionTimingFunction = "";
					innerSidebarRef.value!.removeEventListener("transitionend", handleTransitionEnd);
					innerSidebarRef.value!.removeEventListener("transitioncancel", handleTransitionEnd);
				};
				innerSidebarRef.value!.addEventListener("transitionend", handleTransitionEnd);
				innerSidebarRef.value!.addEventListener("transitioncancel", handleTransitionEnd);

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
	<div class="fm-sidebar" :class="{ isNarrow: context.isNarrow, isDragging: drag.isDragging }" :id="props.id">
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