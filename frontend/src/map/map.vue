<ClientProvider :serverUrl="serverUrl" :padId="padId" @padId="handlePadIdChange" @padName="handlePadNameChange">
	<Main/>
</ClientProvider>