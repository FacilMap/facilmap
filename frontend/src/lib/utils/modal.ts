import { Modal } from "bootstrap";
import { onScopeDispose, ref, Ref, watch } from "vue";

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
}

export interface ModalActions {
	hide: () => void;
}

/**
 * Enables a Bootstrap modal dialog on the element that is saved in the returned {@link ModalActions#ref}.
 */
export function useModal(modalRef: Ref<HTMLElement | undefined>, { emit, onShown, onHide }: ModalConfig): ModalActions {
	const modal = ref<Modal>();

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

	watch(modalRef, (newRef, oldRef) => {
		if (modal.value) {
			modal.value.dispose();
			modal.value = undefined;

		}

		if (oldRef) {
			oldRef.removeEventListener('show.bs.modal', handleShow);
			oldRef.removeEventListener('shown.bs.modal', handleShown);
			oldRef.removeEventListener('hide.bs.modal', handleHide);
			oldRef.removeEventListener('hidden.bs.modal', handleHidden);
		}

		if (newRef) {
			modal.value = new Modal(newRef);
			newRef.addEventListener('show.bs.modal', handleShow);
			newRef.addEventListener('shown.bs.modal', handleShown);
			newRef.addEventListener('hide.bs.modal', handleHide);
			newRef.addEventListener('hidden.bs.modal', handleHidden);

			show();
		}
	}, { immediate: true });

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

	onScopeDispose(() => {
		modal.value?.dispose();
	});

	return {
		hide
	};
}

export function hideAllModals(): void {
	for(const el of [...document.querySelectorAll(".modal")]) {
		Modal.getInstance(el)?.hide();
	}
}
