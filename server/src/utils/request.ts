import requestPromise from "request-promise";
import debug from "debug";
import requestDebug from "request-debug";
import config from "../config";

if(debug.enabled("request")) {
	requestDebug(requestPromise);
}

const request: typeof requestPromise = requestPromise.defaults({
	gzip: true,
	headers: {
		'User-Agent': config.userAgent
	}
});

export default request;
