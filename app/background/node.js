import pify from '../utils/pify';
import { app } from 'electron';
import { spawn } from 'child_process';
import rimraf from 'rimraf';
import { defaultServer, makeClient } from './ipc';

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

let hsd;
let network;

export async function reset() {
  await stop();
  const udPath = app.getPath('userData');
  const walletDir = path.join(udPath, 'hsd', 'wallet');
  await new Promise((resolve, reject) => {
    rimraf(walletDir, error => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
  await start();
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

  const udPath = app.getPath('userData');
  const hsdDir = path.join(udPath, 'hsd');
  const logsDir = path.join(udPath, 'hsd_output');
  if (!fs.existsSync(hsdDir)) {
    await pify(cb => fs.mkdir(hsdDir, { recursive: true }, cb));
  }
  if (!fs.existsSync(logsDir)) {
    await pify(cb => fs.mkdir(logsDir, { recursive: true }, cb));
  }

  const stdout = fs.createWriteStream(path.join(logsDir, 'hsd.out.log'));
  const stderr = fs.createWriteStream(path.join(logsDir, 'hsd.err.log'));
  await pify(cb => stdout.on('open', cb()));
  await pify(cb => stderr.on('open', cb()));
  const args = [
    `--prefix=${hsdDir}`,
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

  const startTime = Date.now();
  hsd = spawn('./node_modules/hsd/bin/hsd', args);
  hsd.stdout.on('data', data => stdout.write(data));
  hsd.stderr.on('data', data => stderr.write(data));

  await new Promise((resolve, reject) => {
    hsd.on('exit', () => {
      stdout.end();
      stderr.end();

      if (Date.now() - startTime < 3000) {
        reject(new Error('hsd crashed, check the logs'));
      }
    });
    setTimeout(resolve, 3000);
  });
}

export async function stop() {
  if (!hsd) {
    return;
  }

  return new Promise((resolve, reject) => {
    hsd.on('close', () => {
      hsd = null;
      resolve();
    });
    hsd.on('error', reject);
    hsd.kill('SIGTERM');
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
