import type { InjectedConfig } from "facilmap-utils";
import $ from "jquery";

const config: InjectedConfig = JSON.parse($("meta[name=fmConfig]").attr("content")!);
export default config;
