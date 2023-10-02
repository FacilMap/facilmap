import fetch from "node-fetch";
import * as yauzl from "yauzl";
import util from "util";
import * as svgo from "svgo";
import cheerio from "cheerio";
import highland from "highland";
import { writeFile } from "fs/promises";
import { fileURLToPath } from 'url';

const outDir = fileURLToPath(new URL('./assets/icons/osmi', import.meta.url));

function streamEachPromise<T>(stream: Highland.Stream<T>, handle: (item: T) => Promise<void> | void): Promise<void> {
	return new Promise((resolve, reject) => {
		stream
			.flatMap((item) => highland(Promise.resolve(handle(item as T))))
			.stopOnError(reject)
			.done(resolve);
	});
}

async function updateIcons() {
    const buffer = await fetch("https://github.com/twain47/Open-SVG-Map-Icons/archive/master.zip").then((res) => res.buffer());
    const zip = (await util.promisify(yauzl.fromBuffer)(buffer))!;

    const entryStream = highland<yauzl.Entry>((push) => {
        zip.on("entry", (entry) => { push(null, entry); });
        zip.on("error", (err) => { push(err); });
    }).filter((entry) => entry.fileName.endsWith(".svg"));

    await streamEachPromise(entryStream, async (entry) => {
        const readStream = (await util.promisify(zip.openReadStream.bind(zip))(entry))!;
        const content = await highland<Buffer>(readStream).collect().map((buffers) => Buffer.concat(buffers)).toPromise(Promise);
        const cleanedContent = cleanIcon(content.toString());
        const outFile = `${outDir}/${entry.fileName.split('/').slice(-2).join('_')}`;
        await writeFile(outFile, Buffer.from(cleanedContent));
    });
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