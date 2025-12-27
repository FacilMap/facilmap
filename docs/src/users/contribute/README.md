# Support FacilMap

FacilMap is a non-commercial free and open-source project developed by [Candid Dauth](https://github.com/cdauth).

## Contribute your time

FacilMap is a service that is created for the community, not for profit. It is made to be useful for its users, not for its users to be useful for its revenue. Here are some ideas how you can participate in making FacilMap even more useful:

* Suggest improvements by creating [issues on GitHub](https://github.com/FacilMap/facilmap/issues)
* Help translate FacilMap into your language on [Weblate](https://hosted.weblate.org/projects/facilmap/)
* If you have the skills, check out the [source code](https://github.com/FacilMap/facilmap) and submit pull requests.

## Contribute your money

Here are some platforms where you can donate, depending on your preference. If your platform of preference is missing here, please raise an issue.

<template v-for="{ width, gap, links } in [{
	width: 740,
	gap: 20,
	links: {
		'GitHub': 'https://github.com/sponsors/FacilMap',
		'Liberapay': 'https://liberapay.com/facilmap/',
		'Ko-fi': 'https://ko-fi.com/facilmap',
		'PayPal': 'https://www.paypal.com/donate?hosted_button_id=FWR59UXY6HGGS',
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

The server infrastructure where FacilMap is hosted is currently paid for with the private money of its creator. FacilMap also relies heavily on third-party services that are kindly provided to the OpenStreetMap community for free. This has worked out so far with the user base still relatively small. As more people are discovering and using FacilMap, more server infrastructure is needed to handle the additional load and data. In addition, as the load that FacilMap induces on third-party services increases, their providers are starting to be unwilling or unable to provide their services for free. This means that as the user base grows, the hosting costs grow exponentially.

So far, FacilMap has been built entirely through unpaid work. While the people who have contributed their time to it have happily done so for free as a service to the community, there is only so much time that each person can afford to work for free. Because of this, development has somewhat stagnated in the last years. If FacilMap ever reaches the point where not only its hosting is funded by the community, but where there is a regular income to fund the work that goes into it, this would greatly increase the development speed and allow the implementation of features wished by the community and entirely new use cases.

If you are using FacilMap for personal or commercial purposes and have some money to spare, your financial contribution would be greatly appreciated. However, you are _not_ expected to donate money if you use FacilMap for activist purposes, if you are already contributing a lot of unpaid time to society otherwise, or if your financial situation makes it difficult to give something.

Please also consider donating to the third-party services that FacilMap relies on:
* [OpenStreetMap](https://supporting.openstreetmap.org/) provides the Mapnik map style, the search result, and hosts the data that all the other services are based on.
* [FOSSGIS](https://www.fossgis.de/verein/spenden/) runs the German chapter of the OpenStreetMap Foundation and hosts the Overpass API that FacilMap uses to show POIs on the map.
* [OpenStreetMap France](https://www.openstreetmap.fr/association/) hosts the CyclOSM map style.