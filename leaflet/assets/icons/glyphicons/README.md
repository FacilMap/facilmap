# Generate the icons again

1. Download Glyphicons SVG from https://github.com/twbs/bootstrap/tree/v3-dev/fonts
2. Convert to icons ZIP on https://iconly.io/tools/font-to-icons-converter
3. Unzip
4. Inside unzipped folder, run `wget -O- https://github.com/twbs/bootstrap/raw/v3-dev/less/glyphicons.less | grep content: | while read -r line; do mv "$(echo -e "\\U$(printf "%08x" "0x$(echo "$line" | sed -re 's/^.*content: "\\(.*?)";.*$/\1/')")").svg" "$(echo "$line" | sed -re 's/^.glyphicon-([^ ]*) .*$/\1/').svg"; done` (Some char codes have multiple icon names, hence some "No such file or directory" errors.)
5. Manually rename `key.svg` and `door.svg` (commented out in less file).
6. Run `inkscape --actions "select-all;fit-canvas-to-selection" --export-overwrite *.svg` ([source](https://superuser.com/a/1750117/23403))
7. Run `svgo *.svg`