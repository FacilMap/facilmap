<b-modal :id="id" title="Manage Views" ok-only ok-title="Close" :busy="isBusy()" size="lg" dialog-class="fm-manage-views">
	<b-table-simple striped hover>
		<b-tbody>
			<b-tr v-for="view in client.views">
				<b-td :class="{ 'font-weight-bold': client.padData.defaultView && view.id == client.padData.defaultView.id }"><a href="javascript:" @click="display(view)">{{view.name}}</a></b-td>
				<b-td class="td-buttons text-right">
					<b-button 
						v-show="!client.padData.defaultView || view.id !== client.padData.defaultView.id"
						@click="makeDefault(view)"
						:disabled="!!isSavingDefaultView || isDeleting[view.id]"
					>
						<b-spinner small v-if="isSavingDefaultView == view.id"></b-spinner>
						Make default
					</b-button>
					<b-button
						@click="deleteView(view)"
						:disabled="isDeleting[view.id] || isSavingDefaultView == view.id"
					>
						<b-spinner small v-if="isDeleting[view.id]"></b-spinner>
						Delete
					</b-button>
				</b-td>
			</b-tr>
		</b-tbody>
	</b-table-simple>
</b-modal>