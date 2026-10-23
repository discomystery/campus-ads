#!/bin/sh
# Stamp a new build id on the page, its stylesheet and scripts, so browsers never mix
# a fresh page with cached scripts from an older version. Run before committing changes.
cd "$(dirname "$0")" || exit 1
id=$(date +%Y%m%d%H%M%S)
sed -i.bak -E "s/(name=\"build\" content=\")[^\"]*/\1$id/; s/\?v=[^\"]*\"/?v=$id\"/g" index.html
sed -i.bak -E "s/^const BUILD = '[^']*';/const BUILD = '$id';/" app.js
sed -i.bak -E "s/D\.build !== '[^']*'/D.build !== '$id'/" suites.js
rm -f index.html.bak app.js.bak suites.js.bak
echo "build $id"
