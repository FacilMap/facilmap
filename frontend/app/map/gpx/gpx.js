(function(fm, $, ng, undefined) {

	function _parseBbox(bboxStr) {
		if(!bboxStr)
			return null;

		var bboxArr = bboxStr.split(bboxStr);
		if(bboxArr.length != 4)
			return null;

		var idxs = [ "left", "top", "right", "bottom" ];
		var ret = { };
		for(var i=0; i<4; i++) {
			ret[idxs[i]] = +bboxArr[i];
			if(!isFinite(ret[idxs[i]]))
				return null;
		}
		return ret;
	}

    fm.app.factory("fmMapGpx", function() {
	    return function(map) {
		    return {
			    exportGpx : function() {
				    map.socket.emit("exportGpx", { useTracks: true }, function(err, gpx) {
					    if(err)
							return map.messages.showMessage("danger", err);

					    saveAs(new Blob([ gpx ], { type: "application/gpx+xml" }), map.socket.padData.name.replace(/[\\\/:*?"<>|]+/g, '_') + '.gpx');
				    })
			    }
		    };
	    };
	});

})(FacilMap, jQuery, angular);