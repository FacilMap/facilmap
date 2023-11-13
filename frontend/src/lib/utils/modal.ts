import Modal from "bootstrap/js/dist/modal";
import { type Ref, shallowRef, watch, watchEffect, reactive, readonly } from "vue";

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

	const handleShown = (e: Event) => {
		onShown?.(e as Modal.Event);
	};

	const handleHide = (e: Event) => {
		onHide?.(e as Modal.Event);
	};

	const handleHidden = (e: Event) => {
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

	watch(modalRef, (newRef, oldRef, onCleanup) => {
		onCleanup(() => {}); // TODO: Delete me https://github.com/vuejs/core/issues/5151#issuecomment-1515613484

		if (newRef) {
			modal.value = new Modal(newRef);
			modal.value.show();

			const existingModals = [...document.querySelectorAll(".modal")].filter((el) => el !== newRef);
			const zIndex = 1 + Math.max(1056, ...existingModals.map((el) => Number(getComputedStyle(el).zIndex) || -Infinity));
			newRef.style.zIndex = `${zIndex}`;
			((modal.value as any)._backdrop._element as HTMLElement).style.zIndex = `${zIndex - 1}`;

			const stackLevel = existingModals.length;
			const content = newRef.querySelector<HTMLElement>(".modal-dialog");
			if (content) {
				content.style.padding = `${20*stackLevel}px ${40*stackLevel}px`;
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
