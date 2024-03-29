import Modal from "bootstrap/js/dist/modal";
import { type Ref, shallowRef, watchEffect, reactive, readonly, effectScope, onActivated, ref, onDeactivated } from "vue";
import { useMaxBreakpoint } from "./bootstrap";
import { fixOnCleanup } from "./vue";

export interface ModalConfig {
	/** Will be called when the fade-in animation has finished. */
	onShown?: (event: Modal.Event) => void;
	/** Will be called before the fade-out animation when the modal is closed. */
	onHide?: (event: Modal.Event) => void;
	/** Will be called after the fade-out animation when the modal is closed. */
	onHidden?: (event: Modal.Event) => void;
	/** If true, the modal can not be closed by clicking the backdrop. */
	static?: Ref<boolean>;
	/** If true, the modal can not be closed by pressing Escape. */
	noEscape?: Ref<boolean>;
}

export interface ModalActions {
	hide: () => void;
}

/**
 * Enables a Bootstrap modal dialog on the element that is saved in the returned {@link ModalActions#ref}.
 */
export function useModal(modalRef: Ref<HTMLElement | undefined>, { onShown, onHide, onHidden, static: isStatic, noEscape }: ModalConfig): Readonly<ModalActions> {
	const modal = shallowRef<Modal>();
	let lastFocusedEl: Element | undefined;

	const handleShown = (e: Event) => {
		const focusEl = (
			modalRef.value?.querySelector<HTMLElement>("[autofocus],.fm-autofocus")
			?? modalRef.value?.querySelector<HTMLElement>("input:not([type=button]):not([type=hidden]):not([type=image]):not([type=reset]):not([type=submit]),textarea,select")
			?? modalRef.value?.querySelector<HTMLElement>(".modal-footer input[type=submit],.modal-footer button[type=submit]")
		);
		focusEl?.focus();

		onShown?.(e as Modal.Event);
	};

	const handleHide = (e: Event) => {
		onHide?.(e as Modal.Event);
	};

	const handleHidden = (e: Event) => {
		if (lastFocusedEl instanceof HTMLElement) {
			lastFocusedEl.focus();
		}
		onHidden?.(e as Modal.Event);
	};

	const result = reactive<ModalActions>({
		hide: () => {
			if (!modal.value) {
				throw new Error('Modal is not initialized.');
			}
			modal.value.hide();
		}
	});

	const isActivated = ref(true);
	onActivated(() => {
		isActivated.value = true;
	});
	onDeactivated(() => {
		isActivated.value = false;
	});

	watchEffect((onCleanup_) => {
		const onCleanup = fixOnCleanup(onCleanup_);

		if (modalRef.value && isActivated.value) {
			const newRef = modalRef.value;

			if (!lastFocusedEl) {
				lastFocusedEl = document.activeElement ?? undefined;
			}

			modal.value = new Modal(newRef);
			modal.value.show();

			const existingModals = [...document.querySelectorAll(".modal")].filter((el) => el !== newRef);
			const zIndex = 1 + Math.max(1056, ...existingModals.map((el) => Number(getComputedStyle(el).zIndex) || -Infinity));
			newRef.style.zIndex = `${zIndex}`;
			((modal.value as any)._backdrop._element as HTMLElement).style.zIndex = `${zIndex - 1}`;

			const stackLevel = existingModals.length;
			const content = newRef.querySelector<HTMLElement>(".modal-dialog");
			if (content) {
				const scope = effectScope();
				scope.run(() => {
					const isTight = useMaxBreakpoint("md");
					watchEffect(() => {
						if (isTight.value) {
							content.style.padding = `calc(var(--bs-modal-margin) * ${stackLevel})`;
						} else {
							content.style.padding = `${20*stackLevel}px ${40*stackLevel}px`;
						}
					});
				});
				onCleanup(() => {
					scope.stop();
				});
			}

			newRef.addEventListener('shown.bs.modal', handleShown);
			newRef.addEventListener('hide.bs.modal', handleHide);
			newRef.addEventListener('hidden.bs.modal', handleHidden);

			onCleanup(() => {
				modal.value!.dispose();
				modal.value = undefined;
				newRef.removeEventListener('shown.bs.modal', handleShown);
				newRef.removeEventListener('hide.bs.modal', handleHide);
				newRef.removeEventListener('hidden.bs.modal', handleHidden);
			});
		}
	});

	watchEffect(() => {
		if (modal.value) {
			const config = (modal.value as any)._config as Modal.Options;
			config.backdrop = isStatic?.value ? "static" : true;
			config.keyboard = !noEscape?.value;
		}
	});

	return readonly(result);
}

export function hideAllModals(): void {
	for(const el of [...document.querySelectorAll(".modal")]) {
		Modal.getInstance(el)?.hide();
	}
}
