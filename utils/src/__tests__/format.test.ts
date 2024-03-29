import { expect, test } from "vitest";
import { getTextContent } from "../format";
import { load } from "cheerio";

test('getTextContent', async () => {
    const code = `
        Beginning
        <div><div>Double block</div></div>
        After block
        <div><p>Nested paragraph</p></div>
        <p><p>Double paragraph
        <div>Double <br><br> line-break</div>
        <div>Multiple  spaces

        and line break</div>
        <table><tbody><tr><td>Table</td><td>cells</td></tr></tbody></table>
    `;
    const $ = load(code, undefined, false);

    expect(getTextContent($.root())).toEqual(
        'Beginning' +
        '\nDouble block' +
        '\nAfter block' +
        '\n\nNested paragraph' +
        '\n\n\nDouble paragraph' +
        '\nDouble\n\nline-break' +
        '\nMultiple spaces and line break' +
        '\nTable cells'
    );
});
