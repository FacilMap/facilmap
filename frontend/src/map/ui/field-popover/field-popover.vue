<b-popover
	v-bind="$props"
	v-on="$listeners"
	triggers="focus"
	placement="bottom"
	:fallback-placement="[]"
	:custom-class="`fm-field-popover ${$props.customClass} ${$props.container ? 'fm-field-popover-custom-container' : ''}`"
	:delay="0"
	boundary="viewport"
>
	<div @keydown="$listeners.keydown" class="fm-field-popover-content">
		<slot></slot>
	</div>
</b-popover>