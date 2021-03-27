<b-tab v-if="markerId" id="fm-marker-info-tab">
	<template #title>
		<span class="closeable-tab-title">
			<span>{{title}}</span>
			<object><a href="javascript:" @click="close()"><Icon icon="remove" alt="Close"></Icon></a></object>
		</span>
	</template>

	<MarkerInfo :markerId="markerId"></MarkerInfo>
</b-tab>