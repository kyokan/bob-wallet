#!/usr/bin/env bash
mkdir -p ./dist
cp app/app.html dist
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )/../"
NODE_ENV=production $DIR/node_modules/.bin/webpack --config ./configs/webpack.config.renderer.prod.babel.js
$DIR/node_modules/.bin/babel $DIR/app/main.js -o ./dist/main.js
$DIR/node_modules/.bin/babel $DIR/app/menu.js -o ./dist/menu.js
$DIR/node_modules/.bin/babel $DIR/app/sentry.js -o ./dist/sentry.js
$DIR/node_modules/.bin/babel $DIR/app/mainWindow.js -o ./dist/mainWindow.js
$DIR/node_modules/.bin/babel $DIR/app/preload.js -o ./dist/preload.js
$DIR/node_modules/.bin/babel $DIR/app/background -d ./dist/background
$DIR/node_modules/.bin/babel $DIR/app/constants -d ./dist/constants
$DIR/node_modules/.bin/babel $DIR/app/db -d ./dist/db
$DIR/node_modules/.bin/babel $DIR/app/utils -d ./dist/utils
$DIR/node_modules/.bin/babel $DIR/app/ducks/walletReducer.js -o ./dist/ducks/walletReducer.js
$DIR/node_modules/.bin/babel $DIR/app/ducks/nodeReducer.js -o ./dist/ducks/nodeReducer.js
$DIR/node_modules/.bin/babel $DIR/app/ducks/hip2Reducer.js -o ./dist/ducks/hip2Reducer.js
$DIR/node_modules/.bin/babel $DIR/app/ducks/claims.js -o ./dist/ducks/claims.js
$DIR/node_modules/.bin/babel $DIR/app/ducks/notifications.js -o ./dist/ducks/notifications.js