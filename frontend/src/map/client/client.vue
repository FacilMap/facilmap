<div class="fm-client-provider">
	<slot v-if="loaded"/>

	<b-toast v-if="client.deleted" id="fm-client-deleted" variant="danger" title="Map deleted" no-auto-hide no-close-button visible>
		<div class="fm-toast-actions">
			<div>This map has been deleted.</div>
			<b-button :href="closeHref" size="sm">Close map</b-button>
		</div>
	</b-toast>

	<b-toast v-else-if="client.serverError" id="fm-client-server-error" variant="danger" title="Error opening map" no-auto-hide no-close-button visible>
		{{this.client.serverError.message}}
	</b-toast>

	<b-toast v-else-if="connecting" id="fm-client-connecting" title="Connecting" no-auto-hide no-close-button visible>
		<b-spinner small></b-spinner>
		Connecting to the server…
	</b-toast>

	<b-toast v-else-if="client.disconnected" id="fm-client-disconnected" variant="danger" title="Disconnected" no-auto-hide no-close-button visible>
		<b-spinner small></b-spinner>
		The connection to the server was lost. Trying to reconnect…
	</b-toast>

	<PadSettings v-if="createId" id="fm-client-create-pad" is-create no-cancel :proposed-admin-id="createId"></PadSettings>
</div>