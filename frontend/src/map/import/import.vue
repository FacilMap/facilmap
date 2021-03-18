<div>
	<input type="file" multiple="multiple" class="d-none" ref="fileInput" @change="importFiles(fileInput.files)">
	<portal to="fm-search-box">
		<b-tab v-for="(file, idx) in files" :id="`fm-import-tab-${idx}`">
			<template #title>
				<span class="fm-import-tab-title">
					<span>{{file.title}}</span>
					<object><a href="javascript:" @click="close(idx)"><Icon icon="remove" alt="Close"></Icon></a></object>
				</span>
			</template>
			<FileResults
				:file="file"
				:layer-id="layerIds[idx]"
				@click-result="zoomToResult"
			></FileResults>
		</b-tab>
	</portal>
</div>