<b-tab v-if="elements.length > 0" :id="`fm${context.id}-overpass-info-tab`">
	<template #title>
		<span class="closeable-tab-title">
			<span>{{elements.length == 1 ? (elements[0].tags.name || "Unnamed POI") : `${elements.length} POIs`}}</span>
			<object><a href="javascript:" @click="close()"><Icon icon="remove" alt="Close"></Icon></a></object>
		</span>
	</template>

	<OverpassMultipleInfo :elements="elements" @click-element="handleElementClick"></OverpassMultipleInfo>
</b-tab>