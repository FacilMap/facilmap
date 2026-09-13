<script setup lang="ts">
	import { CellSelection, findTable, TableMap } from "@tiptap/pm/tables";
	import { isProseMirrorCellSelection, NodeViewContent, nodeViewProps, NodeViewWrapper } from "@tiptap/vue-3";
import { tableClasses } from "facilmap-utils";
	import { computed, toRaw, toRef, watchEffect } from "vue";

	const props = defineProps(nodeViewProps);

	/** The position of the table in the document. */
	const pos = computed(() => props.getPos());

	/** The table node containing the cell. */
	const tableNode = computed(() => {
		if (pos.value != null) {
			return findTable(props.editor.state.doc.resolve(pos.value));
		}
	});

	/** A map with info about the rows/columns of the table containing the cell. */
	const tableMap = computed(() => {
		if (pos.value != null && tableNode.value) {
			return TableMap.get(tableNode.value.node);
		}
	});

	/** The number of the row inside the table (0 being the top row). */
	const rowNumber = computed(() => {
		if (pos.value != null && tableNode.value != null) {
			const $pos = props.view.state.doc.resolve(pos.value);
			let i = 0;
			let index = 0;
			tableNode.value.node.forEach((childNode, offset) => {
				if (offset === $pos.index($pos.depth)) {
					index = i;
				}
				if (childNode.type.name === "tableRow") {
					i++;
				}
			});
			return index;
		}
	});

	// const rect = computed(() => {
	// 	if (pos.value != null && tableNode.value && tableMap.value) {
	// 		return tableMap.value.findCell(pos.value - tableNode.value.start);
	// 	}
	// });

	/** A rect describing the selected cells. */
	const selectedRect = computed(() => {
		if (tableNode.value && tableMap.value && isProseMirrorCellSelection(props.editor.state.selection)) {
			return tableMap.value!.rectBetween(
				props.editor.state.selection.$anchorCell.pos - tableNode.value!.start,
				props.editor.state.selection.$headCell.pos - tableNode.value!.start
			);
		}
	});

	/** Whether the cell is in the top row. */
	const isTop = toRef(() => rowNumber.value === 0);

	/** Whether any whole row is selected. */
	const isRowSelection = computed(() => {
		if (tableMap.value && selectedRect.value) {
			return (
				selectedRect.value.left === 0 &&
				selectedRect.value.right === tableMap.value.width
			);
		}
	});

	/** Whether any whole column is selected. */
	const isColumnSelection = computed(() => {
		if (tableMap.value && selectedRect.value) {
			return (
				selectedRect.value.top === 0 &&
				selectedRect.value.bottom === tableMap.value.height
			);
		}
	});

	/** Whether the whole row containing the cell is selected. */
	const isRowSelected = computed(() => {
		if (rowNumber.value != null && selectedRect.value) {
			return isRowSelection.value && selectedRect.value.top <= rowNumber.value && selectedRect.value.bottom >= rowNumber.value;
		}
	});

	function selectRow(range: boolean) {
		if (pos.value != null) {
			const view = props.editor.view;
			let head;
			if (range && isRowSelection.value && !isRowSelected.value && rowNumber.value != null && selectedRect.value && tableMap.value && tableNode.value) {
				head = tableMap.value.positionAt((
					selectedRect.value.top >= rowNumber.value ? selectedRect.value.bottom - 1 :
					selectedRect.value.top
				), 0, tableNode.value.node) + tableNode.value.start;
			}
			view.dispatch(view.state.tr.setSelection(CellSelection.rowSelection(
				view.state.doc.resolve(pos.value),
				head != null ? view.state.doc.resolve(head) : undefined
			)));
			view.focus();
		}
	}

	function insert(where: "top" | "bottom") {
		if (pos.value) {
			const { from, to } = props.editor.state.selection;
			let chain = props.editor.chain()
				.setNodeSelection(pos.value);

			if (where === "top") {
				chain = chain.addRowBefore();
			} else if (where === "bottom") {
				chain = chain.addRowAfter();
			}

			chain.setTextSelection({ from, to }).run();
		}
	}

	// TODO: Insert columns/rows
	// TODO: Render differently for cases where top/left cell is a merged cell
	// TODO: Handle entire row/column selection when last cell is a merged cell
</script>

<template>
	<NodeViewWrapper as="tr" v-bind="props.HTMLAttributes" :decorations="props.decorations">
		<td>
			<button
				type="button"
				class="fm-table-cell-node-view-left-button"
				:class="{ selected: isRowSelected }"
				@click="selectRow($event.shiftKey)"
			></button>

			<button
				type="button"
				class="fm-table-cell-node-view-top-add-button"
				@click="insert('top')"
			>+</button>

			<button
				type="button"
				class="fm-table-cell-node-view-bottom-add-button"
				@click="insert('bottom')"
			>+</button>
		</td>

		<NodeViewContent></NodeViewContent>
	</NodeViewWrapper>
</template>

<style lang="scss">
	.fm-table-cell-node-view {
		position: relative;

		.fm-table-cell-node-view-top-button,
		.fm-table-cell-node-view-left-button,
		.fm-table-cell-node-view-top-left-button {
			position: absolute;
			border: none;
			padding: 0;
			margin: 0;
			background-color: var(--bs-gray-200);
			border-radius: var(--bs-border-radius);

			&:hover {
				background-color: var(--bs-gray-400);
			}

			&.selected {
				background-color: var(--fm-selected-cell-border-color);
			}
		}

		.fm-table-cell-node-view-top-button {
			position: absolute;
			top: calc(-0.75rem - 3px);
			left: 1px;
			right: 1px;
			height: 0.75rem;
		}

		.fm-table-cell-node-view-left-button {
			position: absolute;
			left: calc(-0.75rem - 3px);
			top: 1px;
			bottom: 1px;
			width: 0.75rem;
		}

		.fm-table-cell-node-view-top-left-button {
			position: absolute;
			left: calc(-0.75rem - 3px);
			top: calc(-0.75rem - 3px);
			width: 0.75rem;
			height: 0.75rem;
		}

		.fm-table-cell-node-view-left-add-button,
		.fm-table-cell-node-view-right-add-button,
		.fm-table-cell-node-view-top-add-button,
		.fm-table-cell-node-view-bottom-add-button {
			position: absolute;
			z-index: 1;

			border: none;
			border-radius: 1000px;

			opacity: 0;
		}

		.fm-table-cell-node-view-left-add-button {
			top: calc(-0.75rem - 3px);
			left: 0;
			transform: translateX(-50%);
		}

		.fm-table-cell-node-view-right-add-button {
			top: calc(-0.75rem - 3px);
			right: 0;
			transform: translateX(50%);
		}

		.fm-table-cell-node-view-top-add-button {
			left: calc(-0.75rem - 3px);
			top: 0;
			transform: translateY(-50%);
		}

		.fm-table-cell-node-view-bottom-add-button {
			left: calc(-0.75rem - 3px);
			bottom: 0;
			transform: translateY(50%);
		}
	}

	.fm-table-cell-node-view:hover :is(
		.fm-table-cell-node-view-left-add-button,
		.fm-table-cell-node-view-right-add-button,
		.fm-table-cell-node-view-top-add-button,
		.fm-table-cell-node-view-bottom-add-button
	) {
		opacity: 1;
	}
</style>