<script setup lang="ts">
	import { injectMapContextRequired } from "../lib/index.js";

	const mapContext = injectMapContextRequired();
</script>

<template>
	<div>
		#{{mapContext.hash}}
	</div>
</template>