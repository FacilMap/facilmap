<div class="fm-overpass-multiple-info">
	<OverpassInfo
		v-if="elements.length == 1"
		:element="elements[0]"
		:is-adding="isAdding"
		@add-to-map="addToMap(elements, $event)"
	></OverpassInfo>
	<b-carousel v-else :interval="0" v-model="activeTab">
		<b-carousel-slide>
			<div class="fm-search-box-collapse-point">
				<b-list-group>
					<b-list-group-item v-for="element in elements" active>
						<span>
							<a href="javascript:" @click="$emit('click-element', element, $event)">{{element.tags.name || 'Unnamed POI'}}</a>
						</span>
						<a href="javascript:" @click="zoomToElement(element)" v-b-tooltip.hover.left="'Zoom to object'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
						<a href="javascript:" @click="openElement(element)" v-b-tooltip.hover.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
					</b-list-group-item>
				</b-list-group>
			</div>

			<b-button-toolbar v-if="client.padData && !client.readonly">
				<b-button v-b-tooltip.hover="'Zoom to selection'" @click="zoom()" size="sm"><Icon icon="zoom-in" alt="Zoom to selection"></Icon></b-button>

				<b-dropdown v-if="client.padData && !client.readonly && types.length > 0" :disabled="isAdding">
					<template #button-content>
						<b-spinner small v-if="isAdding"></b-spinner>
						Add to map
					</template>
					<b-dropdown-item v-for="type in types" href="javascript:" @click="addToMap(elements, type)">{{type.name}}</b-dropdown-item>
				</b-dropdown>
			</b-button-toolbar>
		</b-carousel-slide>

		<b-carousel-slide>
			<OverpassInfo
				v-if="openedElement"
				:element="openedElement"
				show-back-button
				:is-adding="isAdding"
				@back="activeTab = 0"
				@add-to-map="addToMap([openedElement], $event)"
			></OverpassInfo>
		</b-carousel-slide>
	</b-carousel>
</div>