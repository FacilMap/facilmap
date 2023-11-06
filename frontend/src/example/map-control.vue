<script setup lang="ts">
	import { injectMapContextRequired } from "../lib/index.js";

	const mapContext = requireMapContext(context);
</script>

<template>
	<div>
		#{{mapContext.hash}}
	</div>
</template>