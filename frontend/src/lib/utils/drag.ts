import { type DeepReadonly, toRef, ref, readonly, watch } from "vue";
import { useDomEventListener, type AnyRef } from "./utils";

const MOVE_THRESHOLD = 1;

export type DragData<CustomData> = {
	deltaX: number;
	deltaY: number;
	/** Horizontal velocity in px/ms, negative when dragging to the left */
	velocityX: number;
	/** Vertical velocity in px/ms, negative when dragging upwards */
	velocityY: number;
	customData: CustomData;
};

export function useDrag<CustomData>(element: AnyRef<HTMLElement | undefined>, handlers: {
	onDragStart?: () => CustomData;
	onDrag?: (data: DragData<CustomData>) => void;
	onDragEnd?: (data: DragData<CustomData>) => void;
	onClick?: () => void;
}): DeepReadonly<{ isDragging: false } | ({ isDragging: true } & DragData<CustomData>)> {
	const elementRef = toRef(element);
	const dragData = ref<{
		startX: number;
		startY: number;
		deltaX: number;
		deltaY: number;
		lastTime: number;
		velocityX: number;
		velocityY: number;
		pointerId: number;
		started: boolean;
		customData?: CustomData;
	}>();
	let stopTimeout: ReturnType<typeof setTimeout> | undefined;

	watch(elementRef, (value, oldValue, onCleanup) => {
		if (value) {
			const touchActionBkp = value.style.touchAction;
			value.style.touchAction = "none";

			const draggableBkp = value.draggable;
			value.draggable = false;

			onCleanup(() => {
				value.style.touchAction = touchActionBkp;
				value.draggable = draggableBkp;
			});
		}
	}, { immediate: true });

	useDomEventListener(elementRef, "pointerdown", (e) => {
		// Is called when starting to drag, but also when clicking. To distinguish, we set "started" to true only in the first pointermove event.
		dragData.value = {
			startX: e.clientX,
			startY: e.clientY,
			deltaX: 0,
			deltaY: 0,
			velocityX: 0,
			velocityY: 0,
			lastTime: new Date().getTime(),
			pointerId: e.pointerId,
			started: false
		};
	});

	useDomEventListener(elementRef, "pointermove", (e) => {
		if (dragData.value && e.pointerId === dragData.value.pointerId) {
			const deltaX = e.clientX - dragData.value.startX;
			const deltaY = e.clientY - dragData.value.startY;

			if (!dragData.value.started) {
				if ((deltaX ** 2) + (deltaY ** 2) < MOVE_THRESHOLD ** 2) {
					dragData.value.lastTime = new Date().getTime();
					return;
				}

				elementRef.value!.setPointerCapture(e.pointerId);
				Object.assign(dragData.value, {
					customData: handlers.onDragStart?.(),
					started: true
				});
			}

			const time = new Date().getTime();
			const timeDelta = time - dragData.value.lastTime;

			Object.assign(dragData.value, {
				deltaX,
				deltaY,
				velocityX: (deltaX - dragData.value.deltaX) / timeDelta,
				velocityY: (deltaY - dragData.value.deltaY) / timeDelta,
				lastTime: time
			});

			handlers.onDrag?.({
				deltaX: dragData.value.deltaX,
				deltaY: dragData.value.deltaY,
				velocityX: dragData.value.velocityX,
				velocityY: dragData.value.velocityY,
				customData: dragData.value.customData!
			});

			if (stopTimeout) {
				clearTimeout(stopTimeout);
			}
			stopTimeout = setTimeout(() => {
				dragData.value!.velocityX = 0;
				dragData.value!.velocityY = 0;
			}, 250);
		}
	});

	const handlePointerUp = (e: PointerEvent) => {
		if (dragData.value && e.pointerId === dragData.value.pointerId) {
			if (dragData.value?.started) {
				handlers.onDragEnd?.({
					deltaX: dragData.value.deltaX,
					deltaY: dragData.value.deltaY,
					velocityX: dragData.value.velocityX,
					velocityY: dragData.value.velocityY,
					customData: dragData.value.customData!
				});
			}


			if (stopTimeout) {
				clearTimeout(stopTimeout);
				stopTimeout = undefined;
			}

			dragData.value = undefined;
		}
	};

	useDomEventListener(elementRef, "pointerup", (e) => {
		setTimeout(() => { // Call after click event. We cannot prevent the click event, see https://stackoverflow.com/q/18342747/242365
			handlePointerUp(e);
		}, 0);
	});

	useDomEventListener(elementRef, "pointercancel", (e) => {
		handlePointerUp(e);
	});

	useDomEventListener(elementRef, "click", () => {
		if (!dragData.value?.started) {
			handlers.onClick?.();
		}
	});

	return readonly({
		isDragging: toRef(() => !!dragData.value?.started),
		deltaX: toRef(() => dragData.value?.started ? dragData.value.deltaX : undefined),
		deltaY: toRef(() => dragData.value?.started ? dragData.value.deltaY : undefined),
		customData: toRef(() => dragData.value?.started ? dragData.value.customData : undefined)
	}) satisfies DeepReadonly<{ isDragging: boolean; deltaX: number | undefined; deltaY: number | undefined; customData: CustomData | undefined }> as any;
}

export const SWIPE_MIN_VELOCITY = 0.3;

/**
 * Returns true if a drag operation should be interpreted as a swipe. This is the case if the element was dragged by more than half
 * its size or if the drag ended with a high velocity.
 * This should be called in the `onDragEnd` handler of `useDrag()`.
 * @param size The size (width/height) of the element in the axis where a swipe should be detected.
 * @param delta The total distance of the drag operation in the axis where a swipe should be detected. Only positive distances are
 *              interpreted as swipes. If you want to detect swipes to the left/top, pass the delta as a positive number.
 * @param velocity The velocity at the end of the drag operation in px/ms. Only positive velocities are interpreted as swipes. If
 *                 you want to detect swipes to the left/top, pass the velocity as a positive number.
 */
export function isSwipe({ size, delta, velocity }: { size: number; delta: number; velocity: number }): boolean {
	return velocity > SWIPE_MIN_VELOCITY || delta > size / 2;
}

/**
 * Returns a value to apply to the transition CSS property in order to keep sliding an element at the same speed as it was dragged.
 * This is used for elements where we are expecting a swipe operation. The assumption is that we have registered a drag handler using
 * `useDrag()` that moves the element along with it. When the drag ends, the element should either move back to its original position
 * (drag was no swipe) or move out of view by moving it by its width/height (drag was a swipe). Usually we interpret a drag as a swipe
 * using isSwipe().
 * The assumption is also that the element has a CSS transition defined that will move it to the old/new position after the drag ends.
 * If the drag ended with a high velocity and we would then let that CSS transition move it to its final position, the slide operation
 * would not feel smooth, since the initial velocity of the CSS animation would be slower than the drag velocity, causing a stutter.
 * This function returns a timing function that can be temporarily assigned to the CSS transition, causing its initial velocity to be
 * equal to the drag velocity when the drag ended.
 *
 * @param distance Total distance of the transition (number of pixels that the element still has to move)
 * @param duration Total time in ms of the transition
 * @param velocity Velocity of the swipe operation as passed to onDragEnd
 * @return A timing function to apply to transition-timing-function. An empty string if velocity or distance is 0.
 */
export function getSwipeTransition({ distance, duration, velocity }: { distance: number; duration: number; velocity: number }): string {
	// The default easing function of a CSS transition is "ease", which is equivalent to cubic-bezier(0.25, 0.1, 0.25, 1).
	// Since x1 is 0.25 und y1 is 0.1, the initial speed is 0.1/0.25 = 0.4 (in the unit total distance / total time,
	// so in this case the number of pixels that the sidebar still needs to move divided by the transition time (300 ms)).
	// To avoid the perceived stutter in the animation, we try to adjust the initial speed of the transition to the speed
	// of the drag operation by adjusting x1.

	if (distance === 0 || velocity === 0) {
		return "";
	}

	// Convert px/ms velocity of the drag operation to the desired initial transition speed in the unit total distance / total time
	const speed = Math.abs(velocity) * duration / distance;
	// x1 for the CSS easing function with the desired initial speed (y1 stays 0.1 as in the default)
	const x1 = 0.1 / speed;
	return `cubic-bezier(${x1}, 0.1, 0.25, 1)`;
}

export async function applySwipeTransition(element: HTMLElement | HTMLElement[], params: { distance: number; duration: number; velocity: number }): Promise<void> {
	const transition = getSwipeTransition(params);
	await Promise.all((Array.isArray(element) ? element : [element]).map((el) => new Promise<void>((resolve) => {
		el.style.transitionTimingFunction = transition;

		const handleTransitionEnd = () => {
			el.style.transitionTimingFunction = "";
			el.removeEventListener("transitionend", handleTransitionEnd);
			el.removeEventListener("transitioncancel", handleTransitionEnd);
			resolve();
		};
		el.addEventListener("transitionend", handleTransitionEnd);
		el.addEventListener("transitioncancel", handleTransitionEnd);
	})));
}