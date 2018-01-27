import fm from '../app';
import $ from 'jquery';

fm.app.factory("fmIcons", function(fmIconsRaw) {
	const sizes = {
		osmi: 580,
		mdiconic: 1000,
		glyphicons: 1410
	};

	return {
		iconList: [].concat(...Object.keys(fmIconsRaw).map((i) => (Object.keys(fmIconsRaw[i])))),

		getIcon(colour, size, iconName) {
			let set = Object.keys(fmIconsRaw).filter((i) => (fmIconsRaw[i][iconName]))[0];
			if(!set)
				return null;

			if(set == "osmi") {
				return `<g transform="scale(${size / sizes.osmi})">${fmIconsRaw[set][iconName].replace(/#000/g, colour)}</g>`;
			}

			let el = $(fmIconsRaw[set][iconName]);
			let scale = size / sizes[set];
			let moveX = (sizes[set] - el.attr("width")) / 2;
			let moveY = (sizes[set] - el.attr("height")) / 2;

			return `<g transform="scale(${scale}) translate(${moveX}, ${moveY})" fill="${colour}">${el.html()}</g>`;
		}
	};
});
