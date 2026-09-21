import { reactive, ref, type Ref } from "vue";
import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
import { useToasts } from "../ui/toasts/toasts.vue";
import { useI18n } from "../../utils/i18n";
import type { Line } from "facilmap-types";
import { showConfirm } from "../ui/alert.vue";
import { normalizeLineName } from "facilmap-utils";

export function useDeleteLine(line: Ref<Line>): {
	del: () => Promise<void>;
	isDeleting: boolean;
} {
	const toasts = useToasts();
	const i18n = useI18n();

	const context = injectContextRequired();
	const client = requireClientContext(context);

	const isDeleting = ref(false);

	async function del(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-delete`);

		if (!await showConfirm({
			title: i18n.t("line-info.delete-line-title"),
			message: i18n.t("line-info.delete-line-message", { name: normalizeLineName(line.value.name) }),
			variant: "danger",
			okLabel: i18n.t("line-info.delete-line-ok")
		}))
			return;

		isDeleting.value = true;

		try {
			await client.value.deleteLine({ id: line.value.id });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-delete`, () => i18n.t("line-info.delete-line-error"), err);
		} finally {
			isDeleting.value = false;
		}
	}

	return reactive({
		del,
		isDeleting
	});
}