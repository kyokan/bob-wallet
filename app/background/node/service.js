import pify from '../../utils/pify';
import { app, BrowserWindow } from 'electron';
import rimraf from 'rimraf';
import { NETWORKS, VALID_NETWORKS } from '../../constants/networks';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { NodeClient } from 'hs-client';

const Network = require('hsd/lib/protocol/network');

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
let apiKey = crypto.randomBytes(20).toString('hex');

export async function reset() {
  await stop();

  if (network === NETWORKS.MAINNET) {
    await wipeMainnet();
  } else {
    const walletDir = path.join(hsdPrefixDir, network, 'wallet');
    await new Promise((resolve, reject) => rimraf(walletDir, error => {
      if (error) {
        return reject(error);
      }
      resolve();
    }));
  }

  return startNode(network);
}

// Mainnet data doesn't get stored in its own directory,
// so we have to manually nuke it here.
async function wipeMainnet() {
  const dirs = [
    'wallet',
  ];

  for (const dir of dirs) {
    await new Promise((resolve, reject) => rimraf(path.join(hsdPrefixDir, dir), error => {
      if (error) {
        return reject(error);
      }
      resolve();
    }));
  }
}

export async function startNode(net) {
  if (hsd && network === net) {
    return apiKey;
  }
  const newNetwork = VALID_NETWORKS[net];
  if (!newNetwork) {
    throw new Error('invalid network');
  }
  if (hsd) {
    await stop();
  }

  hsd = new BrowserWindow({
    width: 400,
    height: 400,
    show: false,
    webPreferences: {
      nodeIntegration: true,
    },
  });
  network = newNetwork;
  await hsd.loadURL(`file://${path.join(__dirname, '../../hsd.html')}`);
  hsd.webContents.send('start', hsdPrefixDir, network, apiKey);
  await new Promise((resolve, reject) => {
    const lis = (_, channel, ...args) => {
      if (channel !== 'started' && channel !== 'error') {
        return;
      }

      hsd.webContents.removeListener('started', lis);
      hsd.webContents.removeListener('error', lis);

      if (channel === 'error') {
        console.error(args[0]);
        return reject(args[0]);
      }

      resolve();
    };
    hsd.webContents.on('ipc-message', lis);
  });

  const netConfig = Network.get(net);
  const networkOptions = {
    network: netConfig.type,
    port: netConfig.rpcPort,
    apiKey,
  };
  const client = new NodeClient(networkOptions);

  for (let i = 0; i < 10; i++) {
    try {
      await client.getInfo();
      return apiKey;
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

  const netConfig = Network.get(network);
  const networkOptions = {
    network: netConfig.type,
    port: netConfig.rpcPort,
    apiKey,
  };
  const client = new NodeClient(networkOptions);
  await client.execute('stop');

  let attempts = 0;
  const checkDown = async () => {
    try {
      await client.getInfo();
      return false;
    } catch (e) {
      return true;
    }
  };
  for (; attempts < 10; attempts++) {
    const down = await checkDown();
    if (down) {
      break;
    }
  }

  if (attempts === 10) {
    throw new Error('timed out stopping node');
  }

  hsd.close();
  hsd = null;
}

const sName = 'Node';
const methods = {
  start: startNode,
  stop,
  reset,
};

export async function start(server) {
  await setPaths();
  server.withService(sName, methods);
}
