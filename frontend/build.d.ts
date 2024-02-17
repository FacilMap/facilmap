import { InlineConfig, ViteDevServer } from "vite";

export const paths: {
    root: string;
    dist: string;
    base: string;
    mapEntry: string;
    mapEjs: string;
    tableEntry: string;
    tableEjs: string;
    viteManifest: string;
    pwaManifest: string;
    opensearchXmlEjs: string;
};

export function serve(inlineConfig?: InlineConfig): Promise<ViteDevServer>;
