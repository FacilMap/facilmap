import $ from "jquery";

const config = JSON.parse($("meta[name=fmConfig]").attr("content")!);
export default config;
