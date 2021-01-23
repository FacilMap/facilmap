var shortLinkCharArray = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@";

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

fmUtils.temporaryDragMarker = function(map, line, colour, callback, additionalOptions) {
    // This marker is shown when we hover the line. It enables us to create new markers.
    // It is a huge one (a normal marker with 5000 px or so transparency around it, so that we can be
    // sure that the mouse is over it and dragging it will work smoothly.

    let temporaryHoverMarker;
    let lastPos = null;

    function update() {
        if(lastPos) {
            const pointOnLine = fmUtils.getClosestPointOnLine(map, line._latlngs[0], lastPos);
            const distance = map.latLngToContainerPoint(pointOnLine).distanceTo(map.latLngToContainerPoint(lastPos));
            if(distance > line.options.weight / 2)
                lastPos = null;
            else {
                temporaryHoverMarker.setLatLng(pointOnLine);
                if(!temporaryHoverMarker._map)
                    temporaryHoverMarker.addTo(map);
            }
        }

        if(!lastPos && temporaryHoverMarker._map)
            temporaryHoverMarker.remove();
    }

    function _move(e) {
        lastPos = map.mouseEventToLatLng(e.originalEvent);
        update();
    }

    function _out(e) {
        lastPos = null;
        setTimeout(update, 0); // Delay in case there is a mouseover event over the marker following
    }

    line.on("mouseover", _move).on("mousemove", _move).on("mouseout", _out);

    function makeTemporaryHoverMarker() {
        temporaryHoverMarker = L.marker([0,0], Object.assign({
            icon: fmUtils.createMarkerIcon(colour, 35, null, null, 1000),
            draggable: true,
            rise: true
        }, additionalOptions)).once("dragstart", function() {
            temporaryHoverMarker.once("dragend", function() {
                // We have to replace the huge icon with the regular one at the end of the dragging, otherwise
                // the dragging gets interrupted
                this.setIcon(fmUtils.createMarkerIcon(colour));
            }, temporaryHoverMarker);

            callback(temporaryHoverMarker);

            makeTemporaryHoverMarker();
        })
            .on("mouseover", _move).on("mousemove", _move).on("mouseout", _out)
            .on("click", (e) => {
                // Forward to the line to make it possible to click it again
                line.fire("click", e);
            });
    }

    makeTemporaryHoverMarker();

    return function() {
        line.off("mouseover", _move).off("mousemove", _move).off("mouseout", _out);
        temporaryHoverMarker.remove();
    };
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
