import type { InjectedConfig } from "facilmap-utils";

const config: InjectedConfig = JSON.parse(document.querySelector("meta[name=fmConfig]")!.getAttribute("content")!);
export default config;
