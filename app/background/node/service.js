import pify from '../../utils/pify';
import { app } from 'electron';
import { VALID_NETWORKS } from '../../constants/networks';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import tcpPortUsed from 'tcp-port-used';
import EventEmitter from 'events';
import { NodeClient } from 'hs-client';
import { BigNumber } from 'bignumber.js';
import { ConnectionTypes, getConnection, getCustomRPC } from '../connections/service';
import FullNode from 'hsd/lib/node/fullnode';
import { prefixHash } from '../../db/names';
import { get, put } from '../db/service';
import {dispatchToMainWindow} from "../../mainWindow";
import {SET_NODE_API} from "../../ducks/nodeReducer";

const Network = require('hsd/lib/protocol/network');

const MIN_FEE = new BigNumber(0.01);
const DEFAULT_BLOCK_TIME = 10 * 60 * 1000;
const HSD_PREFIX_DIR_KEY = 'hsdPrefixDir';
const NODE_API_KEY = 'nodeApiKey';

export class NodeService extends EventEmitter {
  constructor() {
    super();
  }

  async getAPIKey() {
    const apiKey = await get(NODE_API_KEY);

    if (apiKey) return apiKey;

    const newKey = crypto.randomBytes(20).toString('hex');
    await put(NODE_API_KEY, newKey);
    return newKey;
  }

  async getDir() {
    const hsdPrefixDir = await get(HSD_PREFIX_DIR_KEY);

    if (hsdPrefixDir) {
      return hsdPrefixDir;
    }

    const newPath = path.join(app.getPath('userData'), 'hsd_data');
    await put(HSD_PREFIX_DIR_KEY, newPath);
    return newPath;
  }

  async setNodeDir(dir) {
    if (!fs.existsSync(dir)) {
      throw new Error(`${dir} does not exist`);
    }

    await put(HSD_PREFIX_DIR_KEY, dir);
  }

  async setAPIKey(apiKey) {
    await put(NODE_API_KEY, apiKey);
    dispatchToMainWindow({
      type: SET_NODE_API,
      payload: apiKey,
    });
  }

  async configurePaths() {
    const dir = await this.getDir();
    if (!fs.existsSync(dir)) {
      await pify(cb => fs.mkdir(dir, {recursive: true}, cb));
    }
  }

  async start(networkName) {
    const conn = await getConnection();

    switch (conn.type) {
      case ConnectionTypes.P2P:
        await this.setNetworkAndAPIKey(networkName);
        await this.startNode();
        await this.setHSDLocalClient();
        return;
      case ConnectionTypes.Custom:
        await this.setCustomRPCClient();
        return;
    }
  }

  async setNetworkAndAPIKey(networkName) {
    if (this.hsd) {
      return;
    }

    if (!VALID_NETWORKS[networkName]) {
      throw new Error('Invalid network.');
    }

    const network = Network.get(networkName);

    this.networkName = networkName;
    this.network = network;
    this.apiKey = await this.getAPIKey();

    this.emit('started', this.networkName, this.network, this.apiKey);
  }

  async startNode() {
    if (this.hsd) {
      return;
    }

    const portsFree = await checkHSDPortsFree(this.network);

    if (!portsFree) {
      throw new Error('hsd ports in use. Please make sure no other hsd instance is running, quit Bob, and try again.');
    }

    console.log(`Starting node on ${this.networkName} network.`);

    const dir = await this.getDir();

    const hsd = new FullNode({
      config: true,
      argv: true,
      env: true,
      logFile: true,
      logConsole: false,
      logLevel: 'debug',
      memory: false,
      workers: false,
      network: this.networkName,
      loader: require,
      prefix: dir,
      listen: true,
      bip37: true,
      indexAddress: true,
      indexTX: true,
      apiKey: this.apiKey,
      cors: true,
    });

    await hsd.ensure();
    await hsd.open();
    await hsd.connect();
    await hsd.startSync();

    if (!(await get('hsd-2.4.0-migrate'))) {
      await put('hsd-2.4.0-migrate', true);
    }

    this.hsd = hsd;
  }

  async setHSDLocalClient() {
    const client = new NodeClient({
      network: this.network,
      port: this.network.rpcPort,
      apiKey: this.apiKey,
    });
    await retry(() => client.getInfo(), 20, 200);
    this.client = client;
  }

  async setCustomRPCClient() {
    const rpc = await getCustomRPC();
    const {
      protocol,
      port,
      host,
      pathname,
      apiKey,
    } = rpc;
    const networkType = rpc.networkType || 'main';

    if (!VALID_NETWORKS[networkType]) {
      throw new Error('Invalid network.');
    }

    const network = Network.get(networkType);
    this.networkName = networkType;
    this.network = network;

    this.emit('started', this.networkName, this.network);

    const portString = port ? `:${port}` : '';
    const pathString = (!pathname || pathname === '/') ? '' : pathname;
    const protoString = protocol || 'http';

    const url = `${protoString}://${host}${portString}${pathString}`;
    this.client = new NodeClient({
      network: network,
      apiKey: apiKey,
      url: url,
    });
  }

  async stop() {
    if (this.hsd) {
      await this.hsd.close();
    }

    this.emit('stopped');
    this.hsd = null;
    this.client = null;
  }

  async reset() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 3000));
    await this.start(this.networkName);
  }

  async generateToAddress(numblocks, address) {
    return this._execRPC('generatetoaddress', [numblocks, address]);
  }

  async getInfo() {
    await this._ensureStarted();
    return this.client.getInfo();
  }

  async getTXByAddresses(addresses) {
    await this._ensureStarted();
    return this.client.getTXByAddresses(addresses);
  }

  async getNameInfo(name) {
    return this._execRPC('getnameinfo', [name]);
  }

  async getNameByHash(hash) {
    const cached = await get(prefixHash(hash));
    if (cached) return cached;
    const name = await this._execRPC('getnamebyhash', [hash]);
    put(prefixHash(hash), name);
    return name;
  }

  async getAuctionInfo(name) {
    return this._execRPC('getauctioninfo', [name]);
  }

  async getBlock(height) {
    return this.client.getBlock(height);
  }

  async getBlockByHeight(height, verbose, details) {
    return this._execRPC('getblockbyheight', [height, verbose ? 1 : 0, details ? 1 : 0]);
  }

  async getTx(hash) {
    this._ensureStarted();
    return this.client.getTX(hash);
  }

  async broadcastRawTx(tx) {
    return this._execRPC('sendrawtransaction', [tx]);
  }

  async sendRawAirdrop(data) {
    return this._execRPC('sendrawairdrop', [data]);
  }

  async getFees() {
    await this._ensureStarted();
    const slowRes = await this.client.execute('estimatesmartfee', [5]);
    const standardRes = await this.client.execute('estimatesmartfee', [2]);
    const fastRes = await this.client.execute('estimatesmartfee', [1]);
    const slow = BigNumber.max(new BigNumber(slowRes.fee), MIN_FEE).toFixed(6);
    const standard = BigNumber.max(new BigNumber(standardRes.fee), MIN_FEE * 5).toFixed(6);
    const fast = BigNumber.max(new BigNumber(fastRes.fee), MIN_FEE * 10).toFixed(6);

    return {
      slow,
      standard,
      fast,
    };
  }

  async getAverageBlockTime() {
    await this._ensureStarted();

    const info = await this.client.getInfo();
    const height = info.chain.height;
    if (height <= 1) {
      return DEFAULT_BLOCK_TIME;
    }

    const averageOver = 50;
    const startHeight = Math.max(height - averageOver, 1);
    let previous = 0;
    let count = 0;
    let sum = 0;
    for (let i = startHeight; i <= height; i++) {
      const block = await this.client.execute('getblockbyheight', [i, true, false]);
      if (previous === 0) {
        previous = block.time;
        continue;
      }

      count++;
      sum += (block.time - previous);
      previous = block.time;
    }

    return Math.floor((sum / count) * 1000);
  }

  async getCoin(hash, index) {
    return this.client.getCoin(hash, index);
  }

  async verifyMessageWithName(name, signature, message) {
    return this._execRPC('verifymessagewithname', [name, signature, message]);
  }

  async getRawMempool(verbose = false) {
    return this._execRPC('getrawmempool', [verbose ? 1 : 0]);
  }

  async _ensureStarted() {
    return new Promise((resolve, reject) => {
      if (this.client) {
        resolve();
        return;
      }

      setTimeout(async () => {
        await this._ensureStarted();
        resolve();
      }, 500);
    });
  }

  async _execRPC(method, args) {
    await this._ensureStarted();
    return this.client.execute(method, args);
  }
}

async function checkHSDPortsFree(network) {
  const ports = [
    network.port,
    network.rpcPort,
    // network.walletPort,
    network.nsPort,
  ];

  for (const port of ports) {
    const inUse = await tcpPortUsed.check(port);
    if (inUse) {
      return false;
    }
  }

  return true;
}

async function retry(action, attempts = 10, interval = 200) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await action();
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  console.error('Last err in retry:', lastErr);
  throw new Error('timed out');
}

export const service = new NodeService();

const sName = 'Node';
const methods = {
  start: (networkName) => service.start(networkName),
  stop: () => service.stop(),
  reset: () => service.reset(),
  getAPIKey: () => service.getAPIKey(),
  getInfo: () => service.getInfo(),
  getNameInfo: (name) => service.getNameInfo(name),
  getNameByHash: (hash) => service.getNameByHash(hash),
  getAuctionInfo: (name) => service.getAuctionInfo(name),
  getBlock: (height) => service.getBlock(height),
  generateToAddress: (numblocks, address) => service.generateToAddress(numblocks, address),
  getTXByAddresses: (addresses) => service.getTXByAddresses(addresses),
  getBlockByHeight: (height, verbose, details) => service.getBlockByHeight(height, verbose, details),
  getTx: (hash) => service.getTx(hash),
  verifyMessageWithName: (name, signature, message) => service.verifyMessageWithName(name, signature, message),
  broadcastRawTx: (tx) => service.broadcastRawTx(tx),
  sendRawAirdrop: (data) => service.sendRawAirdrop(data),
  getFees: () => service.getFees(),
  getAverageBlockTime: () => service.getAverageBlockTime(),
  getCoin: (hash, index) => service.getCoin(hash, index),
  setNodeDir: data => service.setNodeDir(data),
  setAPIKey: data => service.setAPIKey(data),
  getDir: () => service.getDir(),
};

export async function start(server) {
  await service.configurePaths();
  server.withService(sName, methods);
}
