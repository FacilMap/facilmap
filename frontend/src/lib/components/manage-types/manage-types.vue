<b-modal :id="id" title="Manage Types" ok-only ok-title="Close" :busy="isBusy()" size="lg" dialog-class="fm-manage-types">
	<b-table-simple striped hover>
		<b-thead>
			<b-tr>
				<b-th>Name</b-th>
				<b-th>Type</b-th>
				<b-th>Edit</b-th>
			</b-tr>
		</b-thead>
		<b-tbody>
			<b-tr v-for="type in client.types">
				<b-td>{{type.name}}</b-td>
				<b-td>{{type.type}}</b-td>
				<b-td class="td-buttons">
					<b-button-group>
						<b-button :disabled="isDeleting[type.id]" @click="openEditDialog(type)">Edit</b-button>
						<b-button @click="deleteType(type)" class="btn btn-default" :disabled="isDeleting[type.id]">
							<b-spinner small v-if="isDeleting[type.id]"></b-spinner>
							Delete
						</b-button>
					</b-button-group>
				</b-td>
			</b-tr>
		</b-tbody>
		<b-tfoot>
			<b-tr>
				<b-td colspan="3"><b-button type="button" @click="openCreateDialog()">Create</b-button></b-td>
			</b-tr>
		</b-tfoot>
	</b-table-simple>

	<EditType v-if="showEditDialog" :id="`fm${context.id}-manage-types-edit-type`" :typeId="editDialogTypeId"></EditType>
</b-modal>