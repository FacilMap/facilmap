<b-tab v-if="lineId" :id="`fm${context.id}-line-info-tab`">
	<template #title>
		<span class="closeable-tab-title">
			<span>{{title}}</span>
			<object><a href="javascript:" @click="close()"><Icon icon="remove" alt="Close"></Icon></a></object>
		</span>
	</template>

	<LineInfo :lineId="lineId"></LineInfo>
</b-tab>