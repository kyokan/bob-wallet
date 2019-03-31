import pify from '../utils/pify';
import { app } from 'electron';
import rimraf from 'rimraf';
import { defaultServer, makeClient } from './ipc';
import * as nodeClient from '../utils/nodeClient';
import { executeBinDep, installBinDep } from './bindeps';

const path = require('path');
const fs = require('fs');
const os = require('os');

export const NETWORKS = {
  SIMNET: 'simnet',
  TESTNET: 'testnet',
  MAINNET: 'mainnet',
  REGTEST: 'regtest'
};

export const VALID_NETWORKS = {
  simnet: 'simnet',
  testnet: 'testnet',
  mainnet: 'mainnet',
  regtest: 'regtest'
};

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
  await start(network);
}

export async function start(net) {
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

  await installBinDep('hsd', os.platform(), 'x86_64');
  const stdout = fs.createWriteStream(path.join(outputDir, 'hsd.out.log'));
  const stderr = fs.createWriteStream(path.join(outputDir, 'hsd.err.log'));
  await pify(cb => stdout.on('open', cb()));
  await pify(cb => stderr.on('open', cb()));
  const args = [
    `--prefix=${hsdPrefixDir}`,
    `--network=${network}`,
    '--log-console=false',
    '--log-file=true',
    '--log-level=debug',
    '--listen',
    '--bip37',
    '--index-address=true',
    '--index-tx=true'
  ];

  if (SEEDS[network]) {
    args.push(`--seeds=${SEEDS[network].join(',')}`);
  }

  hsd = await executeBinDep('spawn', 'hsd', path.join('bin', 'node'), args);
  hsd.stdout.on('data', data => stdout.write(data));
  hsd.stderr.on('data', data => stderr.write(data));

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
  start,
  stop,
  reset
};

export const clientStub = ipcRendererInjector =>
  makeClient(ipcRendererInjector, sName, Object.keys(methods));
defaultServer.withService(sName, methods);
