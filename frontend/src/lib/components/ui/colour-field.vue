<script setup lang="ts">
	import { ColorMixin, Hue, Saturation } from "vue-color";
	import "./colour-field.scss";
	import Picker from "../picker/picker.vue";
	import { makeTextColour } from "facilmap-utils";
	import { arrowNavigation } from "../../../utils/ui";

	function normalizeData(value: string) {
		return ColorMixin.data.apply({ value }).val;
	}

	function isValidColour(colour?: string) {
		return !!colour?.match(/^[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/);
	}

	extend("colour", {
		validate: isValidColour,
		message: "Needs to be in 3-digit or 6-digit hex format, for example <code>f00</code> or <code>0000ff</code>."
	});

	@WithRender
	@Component({
		components: { Picker, Hue, Saturation },
		props: {
			...(Picker as any).options.props
		}
	})
	export default class ColourField extends Vue {

		@Ref() grid!: HTMLElement;

		value?: string;

		colours = [ "ffffff", "ffccc9", "ffce93", "fffc9e", "ffffc7", "9aff99", "96fffb", "cdffff", "cbcefb", "cfcfcf", "fd6864",
		"fe996b", "fffe65", "fcff2f", "67fd9a", "38fff8", "68fdff", "9698ed", "c0c0c0", "fe0000", "f8a102", "ffcc67", "f8ff00", "34ff34",
		"68cbd0", "34cdf9", "6665cd", "9b9b9b", "cb0000", "f56b00", "ffcb2f", "ffc702", "32cb00", "00d2cb", "3166ff", "6434fc", "656565",
		"9a0000", "ce6301", "cd9934", "999903", "009901", "329a9d", "3531ff", "6200c9", "343434", "680100", "963400", "986536", "646809",
		"036400", "34696d", "00009b", "303498", "000000", "330001", "643403", "663234", "343300", "013300", "003532", "010066", "340096" ];

		get val(): any {
			return normalizeData(this.value ?? "");
		}

		get previewStyle(): Partial<CSSStyleDeclaration> {
			const bg = isValidColour(this.value) ? this.value : 'ffffff';
			return {
				backgroundColor: `#${bg}`,
				color: makeTextColour(`#${bg}`)
			};
		}

		handleChange(val: any): void {
			this.$emit('input', normalizeData(val).hex.replace(/^#/, '').toLowerCase());
		}

		handleKeyDown(event: KeyboardEvent): void {
			const newVal = arrowNavigation(this.colours, this.value, this.grid, event);
			if (newVal) {
				this.$emit('input', newVal);
				setTimeout(() => {
					this.grid.querySelector<HTMLElement>(".active a")?.focus();
				}, 0);
			}
		}

	}
</script>

<template>
	<Picker v-bind="$props" v-on="$listeners" custom-class="fm-colour-field" @keydown="handleKeyDown">
		<template #preview>
			<b-input-group-text :style="previewStyle">
				<span style="width: 1.4em"></span>
			</b-input-group-text>
		</template>

		<template #default="{ isModal }">
			<div class="fm-colour-field-content">
				<b-input v-show="isModal" :value="value" @update="$emit('input', $event)" :style="previewStyle"></b-input>
				<Saturation :value="val" @change="handleChange"></Saturation>
				<Hue :value="val" @change="handleChange"></Hue>
				<ul ref="grid">
					<li v-for="colour in colours" :class="{ active: value == colour }">
						<a href="javascript:" :style="{ backgroundColor: `#${colour}` }" @click="$emit('input', colour)"></a>
					</li>
				</ul>
			</div>
		</template>
	</Picker>
</template>

<style lang="scss">
	.fm-colour-field {
		.fm-colour-field-content {
			display: flex;
			flex-direction: column;
			align-items: center;

			> * + * {
				margin-top: 0.5rem;
			}

			.vc-saturation {
				position: relative;
				flex-basis: 100px;
				width: 100%;
			}

			.vc-hue {
				position: static;
				height: 15px;
				width: 100%;
				flex-shrink: 0;
			}

			ul {
				margin-left: 0;
				margin-bottom: 0;
				padding: 0;
				list-style-type: none;
				display: grid;
				grid-template-columns: repeat(9, 15px);
				grid-auto-rows: 15px;
				gap: 5px;

				li {
					display: flex;
				}

				a {
					flex-grow: 1;
					border-radius: 3px;
					box-shadow: inset 0 0 0 1px rgb(0 0 0 / 15%);
					border: none;
				}

				li.active a {
					box-shadow: inset 0 0 0 2px rgb(0 0 0 / 60%), 0 0 3px rgb(0 0 0 / 60%);
				}
			}
		}
	}
</style>