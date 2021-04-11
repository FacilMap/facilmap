<div class="fm-multiple-info">
	<b-carousel :interval="0" v-model="activeTab">
		<b-carousel-slide>
			<b-list-group-item v-for="object in objects" active>
				<span>
					<a href="javascript:" @click="$emit('click-object', object, $event)">{{object.name}}</a>
					{{" "}}
					<span class="result-type" v-if="client.types[object.typeId]">({{client.types[object.typeId].name}})</span>
				</span>
				<a href="javascript:" @click="zoomToObject(object)" v-b-tooltip.hover.left="'Zoom to object'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
				<a href="javascript:" @click="openObject(object)" v-b-tooltip.hover.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
			</b-list-group-item>

			<b-button-toolbar>
				<b-button v-b-tooltip.hover="'Zoom to selection'" @click="zoom()" size="sm"><Icon icon="zoom-in" alt="Zoom to selection"></Icon></b-button>

				<b-button v-if="!client.readonly" size="sm" @click="deleteObjects()" :disabled="isDeleting || mapContext.interaction">
					<b-spinner small v-if="isDeleting"></b-spinner>
					Remove
				</b-button>
			</b-button-toolbar>
		</b-carousel-slide>

		<b-carousel-slide>
			<MarkerInfo
				v-if="openedObject && isMarker(openedObject)"
				:markerId="openedObject.id"
				show-back-button
				@back="activeTab = 0"
			></MarkerInfo>
			<LineInfo
				v-else-if="openedObject && isLine(openedObject)"
				:lineId="openedObject.id"
				show-back-button
				@back="activeTab = 0"
			></LineInfo>
		</b-carousel-slide>
	</b-carousel>
</div>