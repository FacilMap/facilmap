<script setup lang="ts">
	import { range } from "lodash-es";
	import { computed } from "vue";
	import { useI18n } from "../../utils/i18n";

	const i18n = useI18n();

	const props = defineProps<{
		pages: number;
		modelValue: number;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [page: number];
	}>();

	function handleClick(page: number): void {
		emit("update:modelValue", page);
	}

	const isPrevDisabled = computed(() => props.modelValue === 0);
	const isNextDisabled = computed(() => props.modelValue === props.pages - 1);
	const pagesFrom = computed(() => Math.max(0, Math.min(props.modelValue - 2, props.pages - 3)));
	const pagesTo = computed(() => Math.min(props.pages - 1, Math.max(props.modelValue + 2, 2)));
	const pageLinks = computed(() => range(pagesFrom.value, pagesTo.value + 1));
	const showEllipsisBefore = computed(() => pagesFrom.value > 0);
	const showEllipsisAfter = computed(() => pagesTo.value < props.pages - 1);
</script>

<template>
	<ul class="pagination justify-content-center">
		<li class="page-item" :class="{ disabled: isPrevDisabled }">
			<a
				:href="isPrevDisabled ? undefined : 'javascript:'"
				class="page-link"
				:aria-label="i18n.t('pagination.first-label')"
				@click="handleClick(0)"
			>
				<span aria-hidden="true">«</span>
			</a>
		</li>

		<li class="page-item" :class="{ disabled: isPrevDisabled }">
			<a
				:href="isPrevDisabled ? undefined : 'javascript:'"
				class="page-link"
				:aria-label="i18n.t('pagination.previous-label')"
				@click="handleClick(props.modelValue - 1)"
			>
				<span aria-hidden="true">‹</span>
			</a>
		</li>

		<li v-if="showEllipsisBefore" class="page-item">
			<span class="page-link">…</span>
		</li>

		<template v-for="page in pageLinks" :key="page">
			<li class="page-item" :class="{ active: page === props.modelValue }">
				<a href="javascript:" class="page-link" @click="handleClick(page)">{{page + 1}}</a>
			</li>
		</template>

		<li v-if="showEllipsisAfter" class="page-item">
			<span class="page-link">…</span>
		</li>

		<li class="page-item" :class="{ disabled: isNextDisabled }">
			<a
				:href="isNextDisabled ? undefined : 'javascript:'"
				class="page-link"
				:aria-label="i18n.t('pagination.next-label')"
				@click="handleClick(props.modelValue + 1)"
			>
				<span aria-hidden="true">›</span>
			</a>
		</li>

		<li class="page-item" :class="{ disabled: isNextDisabled }">
			<a
				:href="isNextDisabled ? undefined : 'javascript:'"
				class="page-link"
				:aria-label="i18n.t('pagination.last-label')"
				@click="handleClick(pages - 1)"
			>
				<span aria-hidden="true">»</span>
			</a>
		</li>
	</ul>
</template>