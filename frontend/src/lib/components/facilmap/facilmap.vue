<div class="fm-facilmap">
	<ClientProvider>
		<LeafletMap>
			<Toolbox v-if="context.toolbox" :interactive="context.interactive"></Toolbox>
			<Legend v-if="context.legend"></Legend>
			<Import v-if="context.interactive"></Import>
			<ClickMarker></ClickMarker>

			<template #before>
				<slot name="before"></slot>
			</template>

			<template #after>
				<SearchBox></SearchBox>
				<slot name="after"></slot>
			</template>

			<slot></slot>
		</LeafletMap>
	</ClientProvider>
</div>