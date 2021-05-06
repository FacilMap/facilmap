<div class="fm-client-provider" :key="counter">
	<slot v-if="client"/>

	<b-toast v-if="client && client.deleted" id="fm-client-deleted" variant="danger" title="Map deleted" no-auto-hide no-close-button visible>
		<div class="fm-toast-actions">
			<div>This map has been deleted.</div>
			<b-button :href="closeHref" size="sm" @click.exact.prevent="context.activePadId = undefined">Close map</b-button>
		</div>
	</b-toast>

	<b-toast v-else-if="client && client.disconnected" id="fm-client-disconnected" variant="danger" title="Disconnected" no-auto-hide no-close-button visible>
		<b-spinner small></b-spinner>
		The connection to the server was lost. Trying to reconnect…
	</b-toast>

	<PadSettings v-if="createId" id="fm-client-create-pad" is-create no-cancel :proposed-admin-id="createId"></PadSettings>
</div>