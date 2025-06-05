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