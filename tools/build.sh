#!/usr/bin/env bash
set -e

# Electron's version.
export npm_config_target=4.0.1
# The architecture of Electron, can be ia32 or x64.
export npm_config_arch=x64
export npm_config_target_arch=x64
# Download headers for Electron.
export npm_config_disturl=https://atom.io/download/electron
# Tell node-pre-gyp that we are building for Electron.
export npm_config_runtime=electron
# Tell node-pre-gyp to build module from source code.
export npm_config_build_from_source=true

export LDFLAGS="-L/usr/local/opt/openssl@1.1/lib"
export CPPFLAGS="-I/usr/local/opt/openssl@1.1/include"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
git clone git@github.com:kyokan/hsd.git $DIR/hsd

cd $DIR/hsd

# Install all dependencies, and store cache to ~/.electron-gyp.
HOME=~/.electron-gyp npm install
# nuke unbound since it requires a dynamic lib and isn't required
rm -rf ./node_modules/unbound
cp -f ../hsd-node-replacement.js ./bin/node

cd ../
tar --exclude='.git' -czvf hsd-darwin-x86_64.tgz hsd
mv -f hsd-darwin-x86_64.tgz ../app/bindeps
rm -rf hsd

