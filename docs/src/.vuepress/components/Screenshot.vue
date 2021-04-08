<template>
	<div>
		<img :src="desktop" style="height: 340px">
		<img :src="mobile" style="height: 340px">
	</div>
</template>
<script>
	export default {
		props: {
			desktop: String,
			mobile: String
		}
	};
</script>