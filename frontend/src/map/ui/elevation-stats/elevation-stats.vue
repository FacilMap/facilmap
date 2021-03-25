<span class="fm-elevation-stats">
	<span>
		<Icon icon="triangle-top" alt="Ascent"></Icon> {{route.ascent}} m / <Icon icon="triangle-bottom" alt="Descent"></Icon> {{route.descent}} m
	</span>
	<b-button :id="`fm-elevation-stats-${id}`" v-b-tooltip.hover="'Show elevation statistics'"><Icon icon="info-circle" alt="Show stats"></Icon></b-button>
	<b-popover :target="`fm-elevation-stats-${id}`" placement="bottom" triggers="click blur" custom-class="fm-elevation-stats-popover">
		<dl class="row">
			<dt class="col-sm-6">Total ascent</dt>
			<dd class="col-sm-6">{{route.ascent}} m</dd>

			<dt class="col-sm-6">Total descent</dt>
			<dd class="col-sm-6">{{route.descent}} m</dd>

			<template v-for="stat in statsArr">
				<dt class="col-sm-6">{{stat.i == 0 ? '0%' : stat.i < 0 ? "≤ "+stat.i+"%" : "≥ "+stat.i+"%"}}</dt>
				<dd class="col-sm-6">{{stat.distance | round(2)}} km</dd>
			</template>
		</dl>
	</b-popover>
</span>