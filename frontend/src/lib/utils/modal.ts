import { Modal } from "bootstrap";
import { Ref, shallowRef, watch, watchEffect } from "vue";

export interface ModalConfig {
	emit?: {
		/**
		 * Emitted when the modal is closed and the fade-out animation has finished. Should cause the parent component to remove the
		 * modal from the tree.
		 */
		(type: 'hidden'): void;
	};
	/** Will be called when the fade-in animation has finished. */
	onShown?: (event: Modal.Event) => void;
	/** Will be called before the fade-out animation when the modal is closed. */
	onHide?: (event: Modal.Event) => void;
	/** Will be called after the fade-out animation when the modal is closed. */
	onHidden?: (event: Modal.Event) => void;
	/** If true, the modal will not be closed by clicking the backdrop or pressing Escape. */
	static?: Ref<boolean>;
}

export interface ModalActions {
	hide: () => void;
}

/**
 * Enables a Bootstrap modal dialog on the element that is saved in the returned {@link ModalActions#ref}.
 */
export function useModal(modalRef: Ref<HTMLElement | undefined>, { emit, onShown, onHide, static: isStatic }: ModalConfig): ModalActions {
	const modal = shallowRef<Modal>();

	const handleShow = (e: Event) => {
		const zIndex = 1 + Math.max(1056, ...[...document.querySelectorAll(".modal")].map((el) => el !== modalRef.value && Number(getComputedStyle(el).zIndex) || -Infinity));
		modalRef.value!.style.zIndex = `${zIndex}`;
		Promise.resolve().then(() => {
			((modal.value as any)._backdrop._element as HTMLElement).style.zIndex = `${zIndex - 1}`;
		});
	};

	const handleShown = (e: Event) => {
		onShown?.(e as Modal.Event);
	};

	const handleHide = (e: Event) => {
		onHide?.(e as Modal.Event);
	};

	const handleHidden = (e: Event) => {
		if (emit) {
			emit('hidden');
		}
	};

	watch(modalRef, (newRef, oldRef, onCleanup) => {
		if (newRef) {
			modal.value = new Modal(newRef);

			newRef.addEventListener('show.bs.modal', handleShow);
			newRef.addEventListener('shown.bs.modal', handleShown);
			newRef.addEventListener('hide.bs.modal', handleHide);
			newRef.addEventListener('hidden.bs.modal', handleHidden);

			onCleanup(() => {
				modal.value!.dispose();
				modal.value = undefined;
				newRef.removeEventListener('show.bs.modal', handleShow);
				newRef.removeEventListener('shown.bs.modal', handleShown);
				newRef.removeEventListener('hide.bs.modal', handleHide);
				newRef.removeEventListener('hidden.bs.modal', handleHidden);
			});

			show();
		}
	});

	watchEffect(() => {
		if (modal.value) {
			const config = (modal.value as any)._config as Modal.Options;
			config.backdrop = isStatic?.value ? "static" : true;
			config.keyboard = !isStatic?.value;
		}
	});

	const show = () => {
		if (!modal.value) {
			throw new Error('Modal is not initialized.');
		}
		modal.value.show();
	};

	const hide = () => {
		if (!modal.value) {
			throw new Error('Modal is not initialized.');
		}
		modal.value.hide();
	};

	return {
		hide
	};
}

export function hideAllModals(): void {
	for(const el of [...document.querySelectorAll(".modal")]) {
		Modal.getInstance(el)?.hide();
	}
}
