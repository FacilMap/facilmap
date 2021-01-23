import { decodeQueryString, encodeQueryString } from "../utils/utils";

const queryParams = decodeQueryString(location.search);
const toBoolean = (val: string, def: boolean) => (val == null ? def : val != "0" && val != "false" && val != "no");

const context = {
    activePadId: decodeURIComponent(location.pathname.match(/[^/]*$/)![0]),
    urlPrefix: location.protocol + "//" + location.host + location.pathname.replace(/[^/]*$/, ""),
    toolbox: toBoolean(queryParams.toolbox, true),
    search: toBoolean(queryParams.search, true),
    autofocus: toBoolean(queryParams.autofocus, parent === window),
    legend: toBoolean(queryParams.legend, true),
    interactive: toBoolean(queryParams.interactive, parent === window)
};

export default context;

if(!location.hash || location.hash == "#") {
    const moveKeys = Object.keys(queryParams).filter((key) => ([ "zoom", "lat", "lon", "layer", "l", "q", "s", "c" ].includes(key)));
    if(moveKeys.length > 0) {
        const hashParams: Record<string, string> = { };
        for (const key of moveKeys) {
            hashParams[key] = queryParams[key];
            delete queryParams[key];
        }

        const query = encodeQueryString(queryParams);
        const hash = encodeQueryString(hashParams);

        history.replaceState(null, "", context.urlPrefix + (context.activePadId || "") + (query ? "?" + query : "") + "#" + hash);
    }
}

/* setTimeout(function() {
    var map = angular.element($("facilmap", $element)).controller("facilmap");

    $scope.$watch(() => (map.client.padData && map.client.padData.name), function(newVal) {
        $scope.padName = newVal;
    });

    $scope.$watch(() => (map.client.padId), function(padId) {
        if(padId)
            history.replaceState(null, "", fm.URL_PREFIX + padId + location.search + location.hash);
    });
}, 0); */