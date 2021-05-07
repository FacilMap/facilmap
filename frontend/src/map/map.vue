<FacilMap
	:baseUrl="baseUrl"
	:serverUrl="baseUrl"
	:padId.sync="padId"
	:toolbox="toolbox"
	:search="search"
	:autofocus="autofocus"
	:legend="legend"
	:interactive="interactive"
	update-hash
	@update:padName="padName = $event"
></FacilMap>