import { onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { useDomEventListener } from "./utils";

/**
 * Uses the Screen Wake Lock API (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) to keep
 * the screen turned on while the provided "active" ref is true.
 */
export function useWakeLock(active: Ref<boolean>): void {
	if (!("wakeLock" in navigator)) {
		return;
	}

	const wakeLockPending = ref(false);
	const wakeLock = shallowRef<WakeLockSentinel>();

	const requestWakeLock = async () => {
		if (!wakeLockPending.value && !wakeLock.value) {
			wakeLockPending.value = true;
			try {
				wakeLock.value = await navigator.wakeLock.request("screen");
				wakeLock.value.addEventListener("release", () => {
					wakeLock.value = undefined;
				});
			} catch (err: any) {
				console.warn("Error requesting wake lock", err);
			} finally {
				wakeLockPending.value = false;
			}

			if (!active.value) {
				// Wake lock was disabled in the meantime
				releaseWakeLock();
			}
		}
	};

	const releaseWakeLock = () => {
		if (wakeLock.value) {
			// Will call "release" event handler which sets wakeLock.value to undefined
			wakeLock.value.release().catch((err) => {
				console.warn("Error releasing wake lock", err);
			});
		}
	};

	watch(() => active.value, () => {
		if (active.value) {
			void requestWakeLock();
		} else {
			releaseWakeLock();
		}
	}, { immediate: true });

	// Enable wake lock again if it was disabled by the browser because of moving out of the browser.
	// See https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API#reacquiring_a_wake_lock
	useDomEventListener(document, "visibilitychange", () => {
		if (active.value && document.visibilityState === "visible") {
			void requestWakeLock();
		}
	});

	onScopeDispose(() => {
		releaseWakeLock();
	});
}