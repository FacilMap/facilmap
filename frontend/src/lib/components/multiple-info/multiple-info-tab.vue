<b-tab v-if="objects" :id="`fm${context.id}-multiple-info-tab`">
	<template #title>
		<span class="closeable-tab-title">
			<span>{{title}}</span>
			<object><a href="javascript:" @click="close()"><Icon icon="remove" alt="Close"></Icon></a></object>
		</span>
	</template>

	<MultipleInfo :objects="objects" @click-object="handleObjectClick"></MultipleInfo>
</b-tab>