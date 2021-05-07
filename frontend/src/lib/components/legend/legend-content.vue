<div class="fm-legend-content">
	<div v-if="legend1" class="fm-legend1">
		<div v-html="legend1Html"></div>
		<hr v-if="items.length > 0 || legend2" />
	</div>

	<template v-for="(type, idx) in items">
		<hr v-if="idx > 0">
		<h3 @click="toggleFilter(type)" :class="{ filtered: type.filtered }">{{type.name}}</h3>
		<dl>
			<template v-for="item in type.items">
				<dt
					:class="[ 'fm-legend-symbol', 'fm-' + type.type, { filtered: item.filtered, first: item.first, bright: item.bright } ]"
					@click="toggleFilter(type, item)"
					v-html="makeSymbol(type, item)"
					@mouseenter="handleMouseEnter($event.target, type, item)"
					@mouseleave="handleMouseLeave()"
				></dt>
				<dd
					:class="[ 'fm-' + type.type, { filtered: item.filtered, first: item.first, bright: item.bright } ]"
					@click="toggleFilter(type, item)"
					:style="item.strikethrough ? {'text-decoration': 'line-through'} : {}"
					@mouseenter="handleMouseEnter($event.target.previousElementSibling, type, item)"
					@mouseleave="handleMouseLeave()"
				>{{item.label}}</dd>
			</template>
		</dl>
	</template>

	<div v-if="legend2" class="fm-legend2">
		<hr v-if="items.length > 0" />
		<div v-html="legend2Html"></div>
	</div>

	<b-popover v-if="popover" :target="popover.target" placement="left" show custom-class="fm-legend-popover">
		<div :class="[ 'fm-legend-symbol', 'fm-' + popover.type.type, { filtered: popover.item.filtered, bright: popover.item.bright } ]" v-html="makeSymbol(popover.type, popover.item, 40)"></div>
		<p>
			<span :style="popover.item.strikethrough ? {'text-decoration': 'line-through'} : {}">{{popover.item.label}}</span>
			<br>
			<small><em>Click to show/hide objects of this type.</em></small>
		</p>
	</b-popover>
</div>