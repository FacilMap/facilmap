<script setup lang="ts">
	import { useI18n } from "../../utils/i18n";
	import vTooltip from "../../utils/tooltip";
	import Icon from "../ui/icon.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import { getUniqueId } from "../../utils/utils";

	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		originalPassword?: boolean;
	}>(), {
		originalPassword: undefined
	});

	// string must appear first, otherwise "" is cast to false, see https://vuejs.org/guide/components/props.html#boolean-casting
	const password = defineModel<string | boolean>("password", { required: true });
	const password2 = defineModel<string>("password2", { required: true });

	const id = getUniqueId("fm-map-password-edit");

	function validatePassword(password: string): string | undefined {
		if (password === "") {
			return i18n.t("map-password-edit.password-empty-error");
		}
	}

	function validatePassword2(password2: string): string | undefined {
		if (password2 !== password.value) {
			return i18n.t("map-password-edit.password-match-error");
		}
	}
</script>

<template>
	<table class="fm-map-password-edit">
		<tbody>
			<tr>
				<td>
					<div class="form-check fm-form-check-large">
						<input
							class="form-check-input"
							type="checkbox"
							:id="`${id}-enable-password`"
							:checked="password !== false"
							@change="password = ($event.target as HTMLInputElement).checked ? '' : false; password2 = ''"
						/>
						<label class="form-check-label text-nowrap" :for="`${id}-enable-password`">
							{{typeof password === 'string' ? i18n.t("map-password-edit.password-required-input") : i18n.t("map-password-edit.password-required")}}
						</label>
					</div>
				</td>

				<td>
					<template v-if="typeof password === 'string'">
						<ValidatedField
							:value="password"
							:validators="[validatePassword]"
							class="input-group has-validation position-relative"
						>
							<template #default="slotProps">
								<input
									type="password"
									autocomplete="new-password"
									class="form-control"
									v-model="password"
									:ref="slotProps.inputRef"
								/>
								<button
									v-if="props.originalPassword"
									type="button"
									class="btn btn-secondary"
									v-tooltip="i18n.t('map-password-edit.password-reset-tooltip')"
									@click="password = props.originalPassword"
								>
									<Icon icon="rotate-left" :alt="i18n.t('map-password-edit.password-reset-alt')"></Icon>
								</button>
								<div class="invalid-tooltip">
									{{slotProps.validationError}}
								</div>
							</template>
						</ValidatedField>
					</template>
					<template v-else-if="password === true">
						<button
							type="button"
							class="btn btn-link"
							@click="password = password2 = ''"
						>
							{{i18n.t("map-password-edit.password-change")}}
						</button>
					</template>
				</td>
			</tr>

			<tr v-if="typeof password === 'string'">
				<td>
					{{i18n.t("map-password-edit.password-repeat")}}
				</td>
				<td>
					<ValidatedField
						:value="password2"
						:validators="[validatePassword2]"
						class="position-relative"
					>
						<template #default="slotProps">
							<input
								type="password"
								autocomplete="new-password"
								class="form-control"
								v-model="password2"
								:ref="slotProps.inputRef"
							/>
							<div class="invalid-tooltip">
								{{slotProps.validationError}}
							</div>
						</template>
					</ValidatedField>
				</td>
			</tr>
		</tbody>
	</table>
</template>

<style type="scss">
	.fm-map-password-edit {
		width: 100%;

		td:first-child {
			width: 1px;
			padding-right: 0.5rem;
		}

		> tbody > tr:nth-child(2) > td:first-child {
			padding-left: calc(2em + 1px);
		}
	}
</style>