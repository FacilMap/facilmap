<script setup lang="ts">
	import { getLabelsForHistoryEntry, type HistoryEntryLabels } from "./history-utils";
	import type { HistoryEntry } from "facilmap-types";
	import { orderBy } from "lodash-es";
	import { computed, onBeforeUnmount, ref, watch, type DeepReadonly } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import { getUniqueId } from "../../utils/utils";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { injectContextRequired, requireClientContext, requireClientSub } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import Pagination from "../ui/pagination.vue";
	import InfoPopover from "../ui/info-popover.vue";

	type HistoryEntryWithLabels = HistoryEntry & {
		labels: HistoryEntryLabels;
	};

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = requireClientSub(context);

	const toasts = useToasts();
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isLoading = ref(true);
	const isReverting = ref<DeepReadonly<HistoryEntryWithLabels>>();

	const id = getUniqueId("fm-history-dialog");

	const PAGE_SIZE = 50;
	const page = ref(0);
	const pages = ref(0);

	watch(page, async () => {
		isLoading.value = true;

		try {
			await Promise.all([
				(async () => {
					const enableHistorySub = page.value === 0;
					if (!!clientSub.value.subscription.options.history !== enableHistorySub) {
						clientSub.value.subscription.updateSubscription({ ...clientSub.value.subscription.options, history: enableHistorySub });
					}
				})(),
				(async () => {
					clientContext.value.storage.clearHistory(clientSub.value.mapSlug);
					const entries = await clientSub.value.subscription.getHistory({ start: page.value * PAGE_SIZE, limit: PAGE_SIZE });
					pages.value = Math.ceil(entries.totalLength / PAGE_SIZE);
					for (const entry of entries.results) {
						clientContext.value.storage.storeHistoryEntry(clientSub.value.mapSlug, entry);
					}
				})()
			]);
		} catch (err) {
			toasts.showErrorToast(`${id}-listen-error`, () => i18n.t("history-dialog.loading-error"), err);
		} finally {
			isLoading.value = false;
		}
	}, { immediate: true });

	onBeforeUnmount(async () => {
		try {
			clientContext.value.storage.clearHistory(clientSub.value.mapSlug);
			if (clientSub.value.subscription.options.history) {
				await clientSub.value.subscription.updateSubscription({ ...clientSub.value.subscription.options, history: false });
			}
		} catch (err) {
			console.error("Error stopping listening to history", err);
		}
	});

	async function revert(entry: DeepReadonly<HistoryEntryWithLabels>): Promise<void> {
		toasts.hideToast(`${id}-revert-error`);

		if (!await showConfirm({
			title: entry.labels.revert!.title,
			message: entry.labels.revert!.message,
			variant: "warning",
			okLabel: entry.labels.revert!.okLabel
		}))
			return;

		isReverting.value = entry;

		try {
			await clientContext.value.client.revertHistoryEntry(clientSub.value.mapSlug, entry.id);
		} catch (err) {
			toasts.showErrorToast(`${id}-revert-error`, () => i18n.t("history-dialog.revert-error"), err);
		} finally {
			isReverting.value = undefined;
		}
	}

	const history = computed((): Array<DeepReadonly<HistoryEntryWithLabels>> => {
		return orderBy(
			Object.values(clientSub.value.data.history).map((entry) => ({
				...entry,
				time: entry.time.replace(/\.\d+/, ""),
				labels: getLabelsForHistoryEntry(clientSub.value, entry)
			})),
			["time"],
			["desc"]
		);
	});
</script>

<template>
	<ModalDialog
		:title="i18n.t('history-dialog.title')"
		size="xl"
		class="fm-history"
		@hidden="emit('hidden')"
		:isBusy="!!isReverting"
	>
		<p><em>{{i18n.t("history-dialog.introduction")}}</em></p>
		<div v-if="isLoading" class="d-flex justify-content-center">
			<div class="spinner-border"></div>
		</div>
		<table v-else class="table table-striped table-hover history-entries">
			<thead>
				<tr>
					<th style="min-width: 12rem">{{i18n.t("history-dialog.date")}}</th>
					<th style="min-width: 15rem">{{i18n.t("history-dialog.action")}}</th>
					<th></th>
					<th>{{i18n.t("history-dialog.restore")}}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="entry in history" :key="entry.id">
					<td class="align-middle">{{entry.time}}</td>
					<td class="align-middle text-break">
						{{entry.labels.description}}
					</td>
					<td class="td-buttons">
						<InfoPopover
							v-if="entry.labels.diff"
							tag="button"
							type="button"
							class="btn btn-secondary"
							popoverClass="fm-history-popover"
						>
							<table class="table table-hover table-sm">
								<thead>
									<tr>
										<th>{{i18n.t("history-dialog.diff-field")}}</th>
										<th>{{i18n.t("history-dialog.diff-before")}}</th>
										<th>{{i18n.t("history-dialog.diff-after")}}</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="diffItem in entry.labels.diff" :key="diffItem.index">
										<td class="text-break"><code>{{diffItem.index}}</code></td>
										<td class="text-break">{{diffItem.before}}</td>
										<td class="text-break">{{diffItem.after}}</td>
									</tr>
								</tbody>
							</table>
						</InfoPopover>
					</td>
					<td class="td-buttons">
						<div class="d-grid">
							<button
								v-if="entry.labels.revert"
								type="button"
								class="btn btn-secondary"
								:disabled="!!isReverting"
								@click="revert(entry)"
							>
								<div v-if="isReverting === entry" class="spinner-border spinner-border-sm"></div>
								{{entry.labels.revert.button}}
							</button>
						</div>
					</td>
				</tr>
			</tbody>
		</table>
		<Pagination
			v-if="pages > 1"
			:pages="pages"
			v-model="page"
		></Pagination>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-history-popover.fm-history-popover {
		max-width: 500px;

		.popover-body {
			max-height: 70vh;
			overflow: auto;
		}
	}

	.fm-history {
		.history-entries > tbody > tr {
			// Make sure that lines without button have the same height as lines with button
			height: calc(/* button line-height */ 1.5rem + /* button padding */ 2 * 0.375rem + /* button border */ 2 * 1px + /* td padding */ 2 * 0.5rem + /* td border-bottom */ 1px);
		}
	}
</style>