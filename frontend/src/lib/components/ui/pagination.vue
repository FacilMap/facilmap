<script setup lang="ts">
import { range } from 'lodash-es';
import { computed } from 'vue';

	const props = defineProps<{
		pages: number;
		value: number;
	}>();

	const emit = defineEmits<{
		(type: "update", page: number): void;
	}>();

	function handleClick(page: number): void {
		emit("update", page);
	}

	const isPrevDisabled = computed(() => props.value === 0);
	const isNextDisabled = computed(() => props.value === props.pages - 1);
	const pagesFrom = computed(() => Math.max(0, Math.min(props.value - 1, props.pages - 3)));
	const pagesTo = computed(() => Math.min(props.pages - 1, Math.max(props.value + 1, 2)));
	const pageLinks = computed(() => range(pagesFrom.value, pagesTo.value));
	const showEllipsisBefore = computed(() => pagesFrom.value > 0);
	const showEllipsisAfter = computed(() => pagesTo.value < props.pages - 1);
</script>

<template>
	<ul class="pagination justify-content-center">
		<li class="page-item" :class="{ disabled: isPrevDisabled }">
			<a
				:href="isPrevDisabled ? undefined : 'javascript:'"
				class="page-link"
				aria-label="First"
				@click="handleClick(0)"
			>
				<span aria-hidden="true">«</span>
			</a>
		</li>

		<li class="page-item" :class="{ disabled: isPrevDisabled }">
			<a
				:href="isPrevDisabled ? undefined : 'javascript:'"
				class="page-link"
				aria-label="Previous"
				@click="handleClick(value - 1)"
			>
				<span aria-hidden="true">‹</span>
			</a>
		</li>

		<li v-if="showEllipsisBefore" class="page-item">
			<span class="page-link">…</span>
		</li>

		<template v-for="page in pageLinks">
			<li class="page-item" :class="{ active: page === props.value }">
				<a href="javascript:" class="page-link" @click="handleClick(page)">{{page}}</a>
			</li>
		</template>

		<li v-if="showEllipsisAfter" class="page-item">
			<span class="page-link">…</span>
		</li>

		<li class="page-item" :class="{ disabled: isNextDisabled }">
			<a
				:href="isNextDisabled ? undefined : 'javascript:'"
				class="page-link"
				aria-label="Next"
				@click="handleClick(value + 1)"
			>
				<span aria-hidden="true">›</span>
			</a>
		</li>

		<li class="page-item" :class="{ disabled: isNextDisabled }">
			<a
				:href="isNextDisabled ? undefined : 'javascript:'"
				class="page-link"
				aria-label="Last"
				@click="handleClick(pages - 1)"
			>
				<span aria-hidden="true">»</span>
			</a>
		</li>
	</ul>
</template>