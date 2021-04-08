<template>
	<div>
		<video controls style="height: 340px">
			<source :src="desktop">
		</video>
		<video controls style="height: 340px">
			<source :src="mobile">
		</video>
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