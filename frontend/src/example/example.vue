<div>
	<FacilMap :base-url="serverUrl" :server-url="serverUrl" :pad-id.sync="padId1" @update:padName="padName1 = $event">
		<template #before>
			<div>{{padId1}} | {{padName2}}</div>
			<MapControl></MapControl>
		</template>
	</FacilMap>

	<FacilMap :base-url="serverUrl" :server-url="serverUrl" :pad-id.sync="padId2" @update:padName="padName2 = $event">
		<template #before>
			<div>{{padId2}} | {{padName2}}</div>
			<MapControl></MapControl>
		</template>
	</FacilMap>
</div>