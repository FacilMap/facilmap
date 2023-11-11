<script setup lang="ts">
	import { getLabelsForHistoryEntry, type HistoryEntryLabels } from "./history-utils";
	import type { HistoryEntry, ID } from "facilmap-types";
	import { orderBy } from "lodash-es";
	import Icon from "../ui/icon.vue";
	import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import { mapRef } from "../../utils/vue";
	import { getUniqueId } from "../../utils/utils";
	import Popover from "../ui/popover.vue";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	type HistoryEntryWithLabels = HistoryEntry & {
		labels: HistoryEntryLabels;
	};

	const context = injectContextRequired();
	const client = requireClientContext(context);

	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isLoading = ref(true);
	const isReverting = ref<HistoryEntryWithLabels>();
	const activeDiffPopoverId = ref<ID>();

	const diffButtonRefs = reactive(new Map<ID, HTMLElement>());

	const id = getUniqueId("fm-history-dialog");

	onMounted(async () => {
		try {
			await client.value.listenToHistory();
		} catch (err) {
			toasts.showErrorToast(`${id}-listen-error`, "Error loading history", err);
		} finally {
			isLoading.value = false;
		}
	});

	onBeforeUnmount(async () => {
		try {
			await client.value.stopListeningToHistory();
		} catch (err) {
			console.error("Error stopping listening to history", err);
		}
	});

	async function revert(entry: HistoryEntryWithLabels): Promise<void> {
		toasts.hideToast(`${id}-revert-error`);

		if (!await showConfirm({
			title: entry.labels.revert!.button,
			message: entry.labels.revert!.message,
			variant: "warning",
			okLabel: entry.labels.revert!.okLabel
		}))
			return;

		isReverting.value = entry;

		try {
			await client.value.revertHistoryEntry({ id: entry.id });
		} catch (err) {
			toasts.showErrorToast(`${id}-revert-error`, "Error loading history", err);
		} finally {
			isReverting.value = undefined;
		}
	}

	const history = computed((): HistoryEntryWithLabels[] => {
		return orderBy(
			Object.values(client.value.history).map((entry) => ({
				...entry,
				time: entry.time.replace(/\.\d+/, ""),
				labels: getLabelsForHistoryEntry(client.value, entry)
			})),
			["time"],
			["desc"]
		);
	});

	function toggleDiffPopover(entryId: ID, force?: boolean): void {
		const isShown = activeDiffPopoverId.value === entryId;
		const show = force ?? (activeDiffPopoverId.value !== entryId);
		if (isShown !== show) {
			activeDiffPopoverId.value = show ? entryId : undefined;
		}
	}
</script>

<template>
	<ModalDialog
		title="History"
		size="xl"
		class="fm-history"
		@hidden="emit('hidden')"
		:isBusy="!!isReverting"
	>
		<p><em>Here you can inspect and revert the last 50 changes to the map.</em></p>
		<div v-if="isLoading" class="d-flex justify-content-center">
			<div class="spinner-border"></div>
		</div>
		<table v-else class="table table-striped table-hover history-entries">
			<thead>
				<tr>
					<th style="min-width: 12rem">Date</th>
					<th style="min-width: 15rem">Action</th>
					<th></th>
					<th>Restore</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="entry in history" :key="entry.id">
					<td class="align-middle">{{entry.time}}</td>
					<td class="align-middle">
						{{entry.labels.description}}
					</td>
					<td class="td-buttons">
						<button
							v-if="entry.labels.diff"
							type="button"
							class="btn btn-secondary"
							@click="toggleDiffPopover(entry.id)"
							:ref="mapRef(diffButtonRefs, entry.id)"
						>
							<Icon icon="info-sign"></Icon>
						</button>
						<Popover
							:element="diffButtonRefs.get(entry.id)"
							placement="bottom"
							class="fm-history-popover"
							:show="activeDiffPopoverId === entry.id"
							@update:show="toggleDiffPopover(entry.id, $event)"
						>
							<table class="table table-hover table-sm">
								<thead>
									<tr>
										<th>Field</th>
										<th>Before</th>
										<th>After</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="diffItem in entry.labels.diff" :key="diffItem.index">
										<td><code>{{diffItem.index}}</code></td>
										<td>{{diffItem.before}}</td>
										<td>{{diffItem.after}}</td>
									</tr>
								</tbody>
							</table>
						</Popover>
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