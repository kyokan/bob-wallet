#!/usr/bin/env node

/*
This file is copied into the hsd bin directory during the build process.
It is used in order to allow hsd to start without requiring native bindings,
which do not work in an electron context.

The original source can be found in hsd/bin/node.
 */

'use strict';

process.title = 'hsd';

if (process.argv.indexOf('--help') !== -1
  || process.argv.indexOf('-h') !== -1) {
  console.error('See the hsd docs at:');
  console.error('https://handshake-org.github.io');
  process.exit(1);
  throw new Error('Could not exit.');
}

if (process.argv.indexOf('--version') !== -1
  || process.argv.indexOf('-v') !== -1) {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
  throw new Error('Could not exit.');
}

const FullNode = require('../lib/node/fullnode');

const node = new FullNode({
  config: true,
  argv: true,
  env: true,
  logFile: true,
  logConsole: true,
  logLevel: 'debug',
  memory: false,
  workers: true,
  listen: false,
  network: 'testnet',
  loader: require
});

// Temporary hack
if (!node.config.bool('no-wallet') && !node.has('walletdb')) {
  const plugin = require('../lib/wallet/plugin');
  node.use(plugin);
}

if (node.config.str('network') === 'main') {
  console.error('Mainnet not yet active.');
  process.exit(1);
  return;
}

process.on('unhandledRejection', (err, promise) => {
  throw err;
});

(async () => {
  await node.ensure();
  await node.open();
  await node.connect();
  node.startSync();
})().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});
