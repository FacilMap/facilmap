<div class="fm-client-provider" :key="counter">
	<slot v-if="client"/>

	<b-toast v-if="client && client.disconnected" :id="`fm${context.id}-client-disconnected`" variant="danger" title="Disconnected" no-auto-hide no-close-button visible>
		<b-spinner small></b-spinner>
		The connection to the server was lost. Trying to reconnect…
	</b-toast>

	<PadSettings v-if="createId" :id="`fm${context.id}-client-create-pad`" is-create no-cancel :proposed-admin-id="createId"></PadSettings>
</div>