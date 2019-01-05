import pify from '../utils/pify';
import { app } from 'electron';
import rimraf from 'rimraf';
import { defaultServer, makeClient } from './ipc';
import gunzip from 'gunzip-maybe';
import tar from 'tar-fs';
import { execFile } from 'child_process';
import kill from 'tree-kill';
import * as nodeClient from '../utils/nodeClient';

const path = require('path');
const fs = require('fs');

export const NETWORKS = {
  SIMNET: 'simnet',
  TESTNET: 'testnet',
  MAINNET: 'mainnet'
};

const VALID_NETWORKS = {
  simnet: 'simnet',
  testnet: 'testnet',
  mainnet: 'mainnet'
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

export function setPaths() {
  udPath = app.getPath('userData');
  hsdBinDir = path.join(udPath, 'hsd');
  hsdPrefixDir = path.join(udPath, 'hsd_data');
  outputDir = path.join(udPath, 'hsd_output');
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

  await installHSD();
  if (!fs.existsSync(hsdPrefixDir)) {
    await pify(cb => fs.mkdir(hsdPrefixDir, {recursive: true}, cb));
  }
  if (!fs.existsSync(outputDir)) {
    await pify(cb => fs.mkdir(outputDir, {recursive: true}, cb));
  }

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
    '--bip37'
  ];

  if (SEEDS[network]) {
    args.push(`--seeds=${SEEDS[network].join(',')}`);
  }

  hsd = execFile(path.join(hsdBinDir, 'bin', 'node-pure-js'), args, args);
  hsd.stdout.on('data', data => stdout.write(data));
  hsd.stderr.on('data', data => stderr.write(data));

  const nClient = nodeClient.forNetwork(network);
  for (let i = 0; i < 5; i++) {
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

  await new Promise((resolve, reject) => {
    kill(hsd.pid, 'SIGTERM', (err) => {
      if (err) {
        return reject(err);
      }

      hsd = null;
      resolve();
    });
  });

  await awaitFSNotBusy();
}

async function awaitFSNotBusy(count = 0) {
  if (count === 3) {
    throw new Error('timeout exceeded');
  }

  return new Promise((resolve, reject) => {
    fs.open(path.join(hsdPrefixDir, network, 'chain', 'LOCK'), 'r+', (err) => {
      if (err && err.code === 'ENOENT') {
        return resolve();
      }

      if (err && err.code === 'EBUSY') {
        return setTimeout(() => awaitFSNotBusy(count + 1).then(resolve).catch(reject), 500);
      }

      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });
}

async function installHSD() {
  const tarballPath = path.join(__dirname, '../', 'bindeps', 'hsd-darwin-x86_64.tgz');

  if (fs.existsSync(hsdBinDir)) {
    return;
  }
  await pify(cb => fs.mkdir(hsdBinDir, {recursive: true}, cb));

  const stream = fs.createReadStream(tarballPath);
  return new Promise((resolve, reject) => stream.pipe(gunzip()).pipe(tar.extract(udPath))
    .on('error', reject)
    .on('finish', resolve));
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
