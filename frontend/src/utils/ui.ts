import $ from 'jquery';
import './ui.scss';
import { deobfuscate } from "facilmap-utils";

/* 

fmUtils.createLineGraphic = function(colour, width, length) {
    return "data:image/svg+xml,"+encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${length}" height="${width}" version="1.1">` +
        (colour == null ? `<defs><linearGradient id="rainbow" x2="100%" y2="0">${fmUtils.RAINBOW_STOPS}</linearGradient></defs>` : ``) +
        `<rect x="0" y="0" width="${length}" height="${width}" style="fill:${colour == null ? `url(#rainbow)` : `#${colour}`}"/>` +
        `</svg>`);
};

fmUtils.copyToClipboard = function(text) {
    var el = $('<button type="button"></button>').css("display", "none").appendTo("body");
    var c = new Clipboard(el[0], {
        text: function() {
            return text;
        }
    });
    el.click().remove();
    c.destroy();
};

fmUtils.onLongMouseDown = function(map, callback) {
    var mouseDownTimeout, pos;

    function clear() {
        clearTimeout(mouseDownTimeout);
        mouseDownTimeout = pos = null;
        map.off("mousemove", move);
        map.off("mouseup", clear);
    }

    function move(e) {
        if(pos.distanceTo(e.containerPoint) > map.dragging._draggable.options.clickTolerance)
            clear();
    }

    map.on("mousedown", function(e) {
        clear();

        if(e.originalEvent.which != 1) // Only react to left click
            return;

        pos = e.containerPoint;
        mouseDownTimeout = setTimeout(function() {
            callback(e);
        }, 1000);

        map.on("mousemove", move);
        map.on("mouseup", clear);
    });
};


fmUtils.scrollIntoView = function(element) {
    element = $(element);
    let scrollableParent = element.scrollParent();

    function getOffset(el) {
        let ret = 0;
        let t = el;
        while(t) {
            ret += t.offsetTop;
            t = t.offsetParent;
        }
        return ret;
    }

    let parentHeight = scrollableParent[0].clientHeight;
    let resultTop = getOffset(element[0]) - getOffset(scrollableParent[0]);
    let resultBottom = resultTop + element.outerHeight();

    if(scrollableParent[0].scrollTop > resultTop)
        scrollableParent.animate({scrollTop: resultTop});
    else if(scrollableParent[0].scrollTop < resultBottom - parentHeight)
        scrollableParent.animate({scrollTop: resultBottom - parentHeight});
};
*/

export function registerDeobfuscationHandlers(): void {
	const clickHandler = (e: JQuery.ClickEvent) => {
		deobfuscate($(e.target).closest(".emobf") as any);
	};

	const actionHandler = () => {
		$(".emobf,.emobf2").each(function() {
			deobfuscate($(this) as any);
		});

		$(document).off("click", ".emobf", clickHandler);
		$(document).off("mousemove", actionHandler);
		$(document).off("keydown", actionHandler);
	};

	$(document).on("click", ".emobf", clickHandler);
	$(document).one("mousemove", actionHandler);
	$(document).one("keydown", actionHandler);
}