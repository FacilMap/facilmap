<b-modal :id="id" title="History" ok-only ok-title="Close" size="xl" dialog-class="fm-history" @show="handleShow" @hidden="handleHidden" scrollable>
	<p><em>Here you can inspect and revert the last 50 changes to the map.</em></p>
	<b-table-simple striped hover>
		<b-thead>
			<b-tr>
				<b-th style="min-width: 12rem">Date</b-th>
				<b-th style="min-width: 15rem">Action</b-th>
				<b-th></b-th>
				<b-th>Restore</b-th>
			</b-tr>
		</b-thead>
		<b-tbody>
			<b-tr v-for="entry in history">
				<b-td class="align-middle">{{entry.time}}</b-td>
				<b-td class="align-middle">
					{{entry.labels.description}}
				</b-td>
				<b-td class="td-buttons">
					<b-button v-if="entry.labels.diff" @click="handleInfoClick($event.target, entry)" @blur="handleInfoBlur()"><Icon icon="info-sign"></Icon></b-button>
				</b-td>
				<b-td class="td-buttons">
					<b-button v-if="entry.labels.button" block :disabled="!!client.loading" @click="revert(entry)">{{entry.labels.button}}</b-button>
				</b-td>
			</b-tr>
		</b-tbody>
	</b-table-simple>

	<b-popover v-if="popover" :target="popover.target" show placement="bottom" custom-class="fm-history-popover">
		<b-table-simple hover small>
			<b-thead>
				<b-tr>
					<b-th>Field</b-th>
					<b-th>Before</b-th>
					<b-th>After</b-th>
				</b-tr>
			</b-thead>
			<b-tbody>
				<b-tr v-for="diffItem in popover.entry.labels.diff">
					<b-td><code>{{diffItem.index}}</code></b-td>
					<b-td>{{diffItem.before}}</b-td>
					<b-td>{{diffItem.after}}</b-td>
				</b-tr>
			</b-tbody>
		</b-table-simple>
	</b-popover>
</b-modal>