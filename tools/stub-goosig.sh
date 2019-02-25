#!/usr/bin/env bash
set -e

# This file stubs out Goosig in the hsd dependencies,
# because native bigints don't work in webpack.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
cp -f ./goosig-stub.js ../node_modules/hsd/node_modules/goosig/lib/goosig.js
cp -f ./goosig-stub.js ../node_modules/hsd/node_modules/goosig/lib/goo.js
cp -f ./goosig-stub.js ../node_modules/hsd/node_modules/goosig/lib/goo-browser.js
