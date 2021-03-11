<div class="fm-field-input">
	<b-form-textarea v-if="field.type == 'textarea'" :id="id" v-model="effectiveValue"></b-form-textarea>
	<b-form-select v-else-if="field.type == 'dropdown'" :id="id" v-model="effectiveValue" :options="options"></b-form-select>
	<b-form-checkbox v-else-if="field.type == 'checkbox'" :id="id" v-model="effectiveValue" value="1" unchecked-value="0"></b-form-checkbox>
	<b-form-input v-else :id="id" v-model="effectiveValue"></b-form-input>
</div>