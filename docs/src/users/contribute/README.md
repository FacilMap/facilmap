# Support FacilMap

FacilMap is a non-commercial free and open-source project developed by [Candid Dauth](https://github.com/cdauth).

You are welcome to contribute code, improve the documentation or raise ideas on [GitHub](https://github.com/FacilMap/facilmap).

## Contribute financially

Financial contributions are very much appreciated and can be sent through the following channels:

<template v-for="{ width, gap, links } in [{
	width: 740,
	gap: 20,
	links: {
		'GitHub': 'https://github.com/sponsors/FacilMap',
		'Liberapay': 'https://liberapay.com/facilmap/',
		'Ko-fi': 'https://ko-fi.com/facilmap',
		'PayPal': 'https://www.paypal.com/donate?hosted_button_id=FWR59UXY6HGGS',
		'Patreon': 'https://www.patreon.com/facilmap',
		'Bitcoin': 'bitcoin:1PEfenaGXC9qNGQSuL5o6f6doZMYXRFiCv'
	}
}]">
	<template v-for="size in [(width - gap * (Object.keys(links).length - 1)) / Object.keys(links).length]">
		<div style="display: flex; flex-wrap: wrap" :style="{ gap: `${gap}px` }">
			<template v-for="(url, label) in links">
				<a :href="url" target="_blank" style="display: flex; flex-direction: column; align-items: center">
					<qrcode :value="url" :size="size" level="M" render-as="svg" style="margin-bottom: 5px"></qrcode>
					{{label}}
				</a>
			</template>
		</div>
	</template>
</template>