import requestPromise from "request-promise";
import debug from "debug";
import requestDebug from "request-debug";

if(debug.enabled("request")) {
	requestDebug(requestPromise);
}

const request: typeof requestPromise = requestPromise.defaults({
	gzip: true,
	headers: {
		'User-Agent': process.env.fmUserAgent
	}
});

export default request;
