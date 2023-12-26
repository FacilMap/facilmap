import fetch from "node-fetch";
import * as yauzl from "yauzl-promise";
import * as svgo from "svgo";
import cheerio from "cheerio";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const outDir = fileURLToPath(new URL('./assets/icons/osmi', import.meta.url));

async function updateIcons() {
    const buffer = await fetch("https://github.com/twain47/Open-SVG-Map-Icons/archive/master.zip").then((res) => res.arrayBuffer());
    const zip = await yauzl.fromBuffer(Buffer.from(buffer)) as any; // yauzl-promise types are outdated, see https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/67963

    for await (const entry of zip) {
        if (entry.filename.endsWith(".svg")) {
            const readStream = Readable.toWeb(await zip.openReadStream(entry));
            const buffers: Buffer[] = [];
            for await (const buffer of readStream) {
                buffers.push(buffer);
            }
            const content = Buffer.concat(buffers);
            const cleanedContent = cleanIcon(content.toString());
            const outFile = `${outDir}/${entry.filename.split('/').slice(-2).join('_')}`;
            await writeFile(outFile, Buffer.from(cleanedContent));
        }
    }
}

function cleanIcon(icon: string): string {
    const optimized = svgo.optimize(icon);

    const $ = cheerio.load(optimized.data, {
        xmlMode: true
    });

    for (const el of $("*").toArray() as cheerio.TagElement[]) {
        el.name = el.name.replace(/^svg:/, "");
    }

    $("metadata,sodipodi\\:namedview,defs,image").remove();

    for (const el of $("*").toArray()) {
        const $el = $(el);

        const fill = $el.css("fill") || $el.attr("fill");
        if(fill && fill != "none") {
            if(fill != "#ffffff" && fill != "#fff") { // This is the background
                $el.remove();
                continue;
            }

            if($el.css("fill"))
                $el.css("fill", "#000");
            else
                $el.attr("fill", "#000");
        }

        if($el.css("stroke") && $el.css("stroke") != "none")
            $el.css("stroke", "#000");
        else if($el.attr("stroke") && $el.attr("stroke") != "none")
            $el.attr("stroke", "#000");
    }

    return $(":root").html()!.replace(/(>|^)\s+(<|$)/g, "$1$2");
}

updateIcons().then(() => {
    console.log('Success!');
}).catch((err) => {
    console.error('Fatal error', err);
});