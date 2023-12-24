import { createServer } from "vite";
import { dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = `${root}/dist/app`;

export const paths = {
    root,
    dist,
    base: '/_app/',
    mapEntry: "src/map/map.ts",
    mapEjs: `${root}/src/map/map.ejs`,
    tableEntry: "src/table/table.ts",
    tableEjs: `${root}/src/table/table.ejs`,
    manifest: `${dist}/manifest.json`,
};

export async function serve(inlineConfig = {}) {
    return await createServer({
        root,
        ...inlineConfig
    });
}