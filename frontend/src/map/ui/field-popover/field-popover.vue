<b-popover
	v-bind="$props"
	v-on="$listeners"
	triggers="focus"
	placement="bottom"
	:fallback-placement="[]"
	:custom-class="`fm-field-popover ${$props.customClass}`"
	:delay="0"
>
	<div @keydown="$listeners.keydown">
		<slot></slot>
	</div>
</b-popover>