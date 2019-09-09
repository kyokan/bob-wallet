import pify from '../../utils/pify';
import { app } from 'electron';
import rimraf from 'rimraf';
import * as nodeClient from '../../utils/nodeClient';
import { NETWORKS, VALID_NETWORKS } from '../../constants/networks';

import path from 'path';
import fs from 'fs';

const FullNode = require('hsd/lib/node/fullnode');
const WalletPlugin = require('hsd/lib/wallet/plugin');

export const SEEDS = {
  [NETWORKS.SIMNET]: [
    'aorsxa4ylaacshipyjkfbvzfkh3jhh4yowtoqdt64nzemqtiw2whk@45.55.108.48'
  ]
};

let udPath;
let hsdBinDir;
let hsdPrefixDir;
let outputDir;

export async function setPaths() {
  udPath = app.getPath('userData');
  hsdBinDir = path.join(udPath, 'hsd');
  hsdPrefixDir = path.join(udPath, 'hsd_data');
  outputDir = path.join(udPath, 'hsd_output');

  if (!fs.existsSync(hsdPrefixDir)) {
    await pify(cb => fs.mkdir(hsdPrefixDir, {recursive: true}, cb));
  }
  if (!fs.existsSync(outputDir)) {
    await pify(cb => fs.mkdir(outputDir, {recursive: true}, cb));
  }
}

let hsd;
let network;

export async function reset() {
  await stop();
  const walletDir = path.join(hsdPrefixDir, network, 'wallet');
  await new Promise((resolve, reject) => {
    rimraf(walletDir, error => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
  await startNode(network);
}

export async function startNode(net) {
  if (hsd && network === net) {
    return;
  }
  const newNetwork = VALID_NETWORKS[net];
  if (!newNetwork) {
    throw new Error('invalid network');
  }
  if (hsd) {
    await stop();
  }

  network = newNetwork;

  hsd = new FullNode({
    config: true,
    argv: true,
    env: true,
    logFile: true,
    logConsole: false,
    logLevel: 'debug',
    memory: false,
    workers: true,
    network: net,
    loader: require,
    prefix: hsdPrefixDir,
    listen: true,
    bip37: true,
    indexAddress: true,
    indexTX: true,
    seeds: SEEDS[network],
  });

  hsd.use(WalletPlugin);

  await hsd.ensure();
  await hsd.open();
  await hsd.connect();
  hsd.startSync();

  const nClient = nodeClient.forNetwork(network);
  for (let i = 0; i < 10; i++) {
    try {
      await nClient.getInfo();
      return;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error('timed out');
}

export async function stop() {
  if (!hsd) {
    return;
  }

  const nClient = nodeClient.forNetwork(network);
  await nClient.stop();
  await awaitFSNotBusy();
  hsd = null;
}

async function awaitFSNotBusy(count = 0) {
  if (count === 3) {
    throw new Error('timeout exceeded');
  }

  return new Promise((resolve, reject) => {
    fs.open(path.join(hsdPrefixDir, network, 'chain', 'LOCK'), 'r+', (err, fd) => {
      if (err && err.code === 'ENOENT') {
        return resolve();
      }

      if (err && err.code === 'EBUSY') {
        return setTimeout(() => awaitFSNotBusy(count + 1).then(resolve).catch(reject), 500);
      }

      if (err) {
        return reject(err);
      }

      fs.closeSync(fd);
      return resolve();
    });
  });
}

const sName = 'Node';
const methods = {
  start: startNode,
  stop,
  reset
};


export async function start(server) {
  await setPaths();
  server.withService(sName, methods);
}
