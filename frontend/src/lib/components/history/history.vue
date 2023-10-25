<script setup lang="ts">
	import WithRender from "./history.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext } from "../../utils/decorators";
	import { showErrorToast } from "../../utils/toasts";
	import { getLabelsForHistoryEntry, HistoryEntryLabels } from "./history-utils";
	import { HistoryEntry } from "facilmap-types";
	import { orderBy } from "lodash-es";
	import Icon from "../ui/icon/icon";
	import "./history.scss";
	import { Context } from "../facilmap/facilmap";

	type HistoryEntryWithLabels = HistoryEntry & {
		labels: HistoryEntryLabels;
	};

	@WithRender
	@Component({
		components: { Icon }
	})
	export default class History extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();

		@Prop({ type: String, required: true }) id!: string;

		popover: { entry: HistoryEntryWithLabels; target: HTMLElement } | null = null;
		isLoading = true;
		reverting: HistoryEntryWithLabels | null = null;

		handleShow(): void {
			this.isLoading = true;
		}

		async handleShown(): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-history-error`);

			try {
				await this.client.listenToHistory();
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-history-error`, "Error loading history", err);
			} finally {
				this.isLoading = false;
			}
		}

		async handleHidden(): Promise<void> {
			try {
				await this.client.stopListeningToHistory();
			} catch (err) {
				console.error("Error stopping listening to history", err);
			}
		}

		async revert(entry: HistoryEntryWithLabels): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-history-error`);

			if (!await this.$bvModal.msgBoxConfirm(entry.labels.confirm))
				return;

			this.reverting = entry;

			try {
				await this.client.revertHistoryEntry({ id: entry.id });
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-history-error`, "Error loading history", err);
			} finally {
				this.reverting = null;
			}
		}

		get history(): HistoryEntryWithLabels[] {
			return orderBy(
				Object.values(this.client.history).map((entry) => ({
					...entry,
					time: entry.time.replace(/\.\d+/, ""),
					labels: getLabelsForHistoryEntry(this.client, entry)
				})),
				["time"],
				["desc"]
			);
		}

		handleInfoClick(target: HTMLElement, entry: HistoryEntryWithLabels): void {
			this.popover = { target, entry };
		}

		handleInfoBlur(): void {
			this.popover = null;
		}

	}
</script>

<template>
	<b-modal
		:id="id"
		title="History"
		ok-only
		ok-title="Close"
		size="xl"
		dialog-class="fm-history"
		@show="handleShow"
		@shown="handleShown"
		@hidden="handleHidden"
		:is-busy="!!reverting"
		scrollable
	>
		<p><em>Here you can inspect and revert the last 50 changes to the map.</em></p>
		<div v-if="isLoading" class="d-flex justify-content-center">
			<div class="spinner-border"></div>
		</div>
		<table v-else class="table table-striped table-hover">
			<thead>
				<tr>
					<th style="min-width: 12rem">Date</th>
					<th style="min-width: 15rem">Action</th>
					<th></th>
					<th>Restore</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="entry in history">
					<td class="align-middle">{{entry.time}}</td>
					<td class="align-middle">
						{{entry.labels.description}}
					</td>
					<td class="td-buttons">
						<button
							v-if="entry.labels.diff"
							type="button"
							class="btn btn-light"
							@click="handleInfoClick($event.target, entry)"
							@blur="handleInfoBlur()"
						>
							<Icon icon="info-sign"></Icon>
						</button>
					</td>
					<td class="td-buttons">
						<div class="d-grid">
							<button
								v-if="entry.labels.button"
								type="button"
								class="btn btn-light"
								:disabled="!!reverting"
								@click="revert(entry)"
							>
								<div v-if="reverting === entry" class="spinner-border spinner-border-sm"></div>
								{{entry.labels.button}}
							</button>
						</div>
					</td>
				</tr>
			</tbody>
		</table>

		<b-popover v-if="popover" :target="popover.target" show placement="bottom" custom-class="fm-history-popover">
			<table class="table table-hover table-sm">
				<thead>
					<tr>
						<th>Field</th>
						<th>Before</th>
						<th>After</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="diffItem in popover.entry.labels.diff">
						<td><code>{{diffItem.index}}</code></td>
						<td>{{diffItem.before}}</td>
						<td>{{diffItem.after}}</td>
					</tr>
				</tbody>
			</table>
		</b-popover>
	</b-modal>
</template>

<style lang="scss">
	.fm-history-popover.fm-history-popover {
		max-width: 500px;

		.popover-body {
			max-height: 70vh;
			overflow: auto;
		}
	}
</style>