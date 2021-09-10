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
import SPVNode from 'hsd/lib/node/spvnode';
import plugin from 'hsd/lib/wallet/plugin';
import { prefixHash } from '../../db/names';
import { get, put } from '../db/service';
import {dispatchToMainWindow} from "../../mainWindow";
import {
  SET_NODE_API,
  SET_CUSTOM_RPC_STATUS,
  START,
  SET_FEE_INFO,
  SET_NODE_INFO,
  SET_SPV_MODE,
  START_NODE_STATUS_CHANGE,
  END_NODE_STATUS_CHANGE,
} from "../../ducks/nodeReducer";

const Network = require('hsd/lib/protocol/network');

const MIN_FEE = new BigNumber(0.01);
const DEFAULT_BLOCK_TIME = 10 * 60 * 1000;
const HSD_PREFIX_DIR_KEY = 'hsdPrefixDir';
const NODE_API_KEY = 'nodeApiKey';
const NODE_NO_DNS = 'nodeNoDns';
const SPV_MODE = 'nodeSpvMode';

export class NodeService extends EventEmitter {
  constructor() {
    super();

    this.height = 0;
  }

  async getAPIKey() {
    const apiKey = await get(NODE_API_KEY);

    if (apiKey) return apiKey;

    const newKey = crypto.randomBytes(20).toString('hex');
    await put(NODE_API_KEY, newKey);
    return newKey;
  }

  async getNoDns() {
    const noDns = await get(NODE_NO_DNS);
    if (noDns !== null) {
      return noDns === '1';
    }

    await put(NODE_NO_DNS, '1');
    return true;
  }

  async getSpvMode() {
    const spv = await get(SPV_MODE);
    if (spv !== null) {
      return spv === '1';
    }

    return false;
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

  async setSpvMode(spv) {
    await put(SPV_MODE, !!spv ? '1' : '');
    dispatchToMainWindow({
      type: SET_SPV_MODE,
      payload: spv === '1',
    });
  }

  async setNoDns(noDns) {
    await put(NODE_NO_DNS, noDns === true ? '1' : '0');
  }

  async configurePaths() {
    const dir = await this.getDir();
    if (!fs.existsSync(dir)) {
      await pify(cb => fs.mkdir(dir, {recursive: true}, cb));
    }
  }

  async start(networkName) {
    await this.setNetworkAndNodeOptions(networkName);
    const conn = await getConnection();

    switch (conn.type) {
      case ConnectionTypes.P2P:
        await this.startNode();
        await this.setHSDLocalClient();
        dispatchToMainWindow({
          type: SET_CUSTOM_RPC_STATUS,
          payload: false,
        });
        dispatchToMainWindow({
          type: START,
          payload: {
            network: this.networkName,
            apiKey: this.apiKey,
            noDns: this.noDns,
          },
        });
        break;
      case ConnectionTypes.Custom:
        await this.setCustomRPCClient();
        dispatchToMainWindow({
          type: SET_CUSTOM_RPC_STATUS,
          payload: true,
        });
        dispatchToMainWindow({
          type: START,
          payload: {
            network: this.networkName,
            apiKey: null,
            noDns: true,
          },
        });
        break;
      default:
        throw new Error('Unknown connection type.');
    }
  }

  async setNetworkAndNodeOptions(networkName) {
    if (!VALID_NETWORKS[networkName]) {
      throw new Error('Invalid network.');
    }

    const network = Network.get(networkName);

    this.networkName = networkName;
    this.network = network;
    this.apiKey = await this.getAPIKey();
    this.noDns = await this.getNoDns();
  }

  async startNode() {
    if (this.hsd) {
      // The app was restarted but the nodes are already running,
      // just re-dispatch to redux store.
      await this.refreshNodeInfo();
      this.emit('start local');
      return;
    }

    const portsFree = await checkHSDPortsFree(this.network);

    if (!portsFree) {
      throw new Error('hsd ports in use. Please make sure no other hsd instance is running, quit Bob, and try again.');
    }

    console.log(`Starting node on ${this.networkName} network.`);

    const dir = await this.getDir();
    const spv = await this.getSpvMode();

    const Node = spv ? SPVNode : FullNode;

    this.hsd = new Node({
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
      indexAddress: true,
      indexTX: true,
      apiKey: this.apiKey,
      walletApiKey: this.apiKey,
      cors: true,
      noDns: this.noDns,
      listen: this.networkName === 'regtest', // improves remote rpc dev/testing
    });

    this.hsd.use(plugin);

    await this.hsd.ensure();
    await this.hsd.open();
    this.emit('start local', this.hsd.get('walletdb'), this.apiKey);
    await this.hsd.connect();
    await this.hsd.startSync();

    if (!(await get('hsd-2.4.0-migrate'))) {
      await put('hsd-2.4.0-migrate', true);
    }

    this.hsd.on('connect', async () => this.refreshNodeInfo());
  }

  async setHSDLocalClient() {
    if (this.client) {
      // The app was restarted but the nodes are already running,
      // just re-dispatch to redux store.
      return this.refreshNodeInfo();
    }

    this.client = new NodeClient({
      network: this.network,
      port: this.network.rpcPort,
      apiKey: this.apiKey,
    });

    this.client.on('error', e => {
      console.error('nodeclient error', e);
    });

    await this.client.open();
    await this.refreshNodeInfo()
  }

  async setCustomRPCClient() {
    if (this.client) {
      // The app was restarted but the nodes are already running,
      // just re-dispatch to redux store.
      await this.refreshNodeInfo();
      this.emit('start remote');
    }

    this.client = await this.createCustomRPCClient();

    this.client.on('error', e => {
      console.error('nodeclient error', e);
    });

    await this.client.open();
    await this.refreshNodeInfo()
    this.client.bind('block connect', async () => this.refreshNodeInfo());
    this.emit('start remote', this.network);
  }

  async testCustomRPCClient(walletNetwork) {
    try {
      if(!walletNetwork)
        throw new Error('Could not determine wallet network.');

      const testClient = await this.createCustomRPCClient();
      const info = await testClient.getInfo();

      if (info.network !== walletNetwork)
        throw new Error('Wallet / Node network mismatch.');

      return [true, null];
    } catch (e) {
      return [false, e.message];
    }
  }

  async createCustomRPCClient() {
    const rpc = await getCustomRPC();
    const {
      protocol,
      port,
      host,
      pathname,
      apiKey,
    } = rpc;

    const portString = port ? `:${port}` : '';
    const pathString = (!pathname || pathname === '/') ? '' : pathname;
    const protoString = protocol || 'http';

    const url = `${protoString}://${host}${portString}${pathString}`;

    // Not really used after this point,
    // but overwrite the local getAPIKey() just in case.
    this.apiKey = apiKey;

    return new NodeClient({
      network: this.network,
      apiKey,
      url,
    });
  }

  async stop() {
    if (this.client)
      await this.client.close();

    if (this.hsd)
      await this.hsd.close();

    this.hsd = null;
    this.client = null;
    this.height = 0;

    this.emit('stopped');
  }

  async reset() {
    dispatchToMainWindow({ type: START_NODE_STATUS_CHANGE });
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.start(this.networkName);
      dispatchToMainWindow({ type: END_NODE_STATUS_CHANGE });
    } catch (e) {
      dispatchToMainWindow({ type: END_NODE_STATUS_CHANGE });
      throw e;
    }
  }

  async refreshNodeInfo() {
    if (!this.client)
      return;

    try {
      const info = await this.getInfo();

      dispatchToMainWindow({
        type: SET_NODE_INFO,
        payload: info.chain,
      });


      if (info.chain.progress > 0.99) {
        const fees = await this.getFees();

        if (fees) {
          dispatchToMainWindow({
            type: SET_FEE_INFO,
            payload: fees,
          });
        }
      }

      this.height = info.chain.height;
    } catch (e) {
    }
  };

  async generateToAddress(numblocks, address) {
    return this._execRPC('generatetoaddress', [numblocks, address]);
  }

  async getInfo() {
    await this._ensureStarted();
    return this.client.getInfo();
  }

  async getTXByAddresses(addresses) {
    if (await this.getSpvMode()) {
      return hapiPost('/tx/address', { addresses });
    }
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
    if (await this.getSpvMode()) {
      return hapiGet(`/block/${block}`);
    }
    return this.client.getBlock(height);
  }

  async getBlockByHeight(height, verbose, details) {
    return this._execRPC('getblockbyheight', [height, verbose ? 1 : 0, details ? 1 : 0]);
  }

  async getTx(hash) {
    if (await this.getSpvMode()) {
      return hapiGet(`/tx/${hash}`);
    }
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
    const slowRes = await this._execRPC('estimatesmartfee', [5]);
    const standardRes = await this._execRPC('estimatesmartfee', [2]);
    const fastRes = await this._execRPC('estimatesmartfee', [1]);
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
      const block = await this._execRPC('getblockbyheight', [i, true, false]);
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
    if (await this.getSpvMode()) {
      return hapiGet(`/coin/${hash}/${index}`);
    }
    return this.client.getCoin(hash, index);
  }

  async verifyMessageWithName(name, signature, message) {
    return this._execRPC('verifymessagewithname', [name, signature, message]);
  }

  async getRawMempool(verbose = false) {
    return this._execRPC('getrawmempool', [verbose ? 1 : 0]);
  }

  async getHNSPrice() {
    try {
      const response = await (
        await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=handshake&vs_currencies=usd'
        )
      ).json();
      return response.handshake.usd || 0;
    } catch (error) {
      return 0;
    }
  }

  async getDNSSECProof(url) {
    return this._execRPC('getdnssecproof', [url, true]);
  }

  async sendRawClaim(base64) {
    return this._execRPC('sendrawclaim', [base64]);
  }

  async _ensureStarted() {
    if (!this.client)
      throw new Error('No client.');
  }

  async _execHostedRPC(method, args) {
    const json = await hapiPost('', {
      method,
      params: args,
    });

    if (!json) {
      throw new Error('No body for JSON-RPC response.');
    }

    return json.result;
  }

  async _execRPC(method, args) {
    if (await this.getSpvMode()) {
      return this._execHostedRPC(method, args);
    }
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

export const service = new NodeService();

const sName = 'Node';
const methods = {
  start: (networkName) => service.start(networkName),
  stop: () => service.stop(),
  reset: () => service.reset(),
  getAPIKey: () => service.getAPIKey(),
  getNoDns: () => service.getNoDns(),
  getSpvMode: () => service.getSpvMode(),
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
  setNoDns: data => service.setNoDns(data),
  setSpvMode: data => service.setSpvMode(data),
  getDir: () => service.getDir(),
  getHNSPrice: () => service.getHNSPrice(),
  testCustomRPCClient: (networkType) => service.testCustomRPCClient(networkType),
  getDNSSECProof: (url) => service.getDNSSECProof(url),
  sendRawClaim: (base64) => service.sendRawClaim(base64),
};

export async function start(server) {
  await service.configurePaths();
  server.withService(sName, methods);
}

async function hapiGet(path = '') {
  const res = await fetch(`https://5pi.io/hsd${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`x:775f8ca39e1748a7b47ff16ad4b1b9ad`).toString('base64'),
    }
  });
  const json = await res.json();

  if (!json)
    throw new Error('Bad response (no body).');

  if (json.error && res.statusCode >= 400) {
    const {error} = json;
    const err = new Error(error.message);
    err.type = String(error.type);
    err.code = error.code;
    throw err;
  }

  if (res.status !== 200)
    throw new Error(`Status code: ${res.status}.`);

  return json;
}

async function hapiPost(path = '', body) {
  const res = await fetch(`https://5pi.io/hsd${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`x:775f8ca39e1748a7b47ff16ad4b1b9ad`).toString('base64'),
    },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (!json)
    throw new Error('No body for JSON-RPC response.');

  if (json.error) {
    const {message, code} = json.error;
    throw new Error(message);
  }

  if (res.status !== 200)
    throw new Error(`Status code: ${res.status}.`);

  return json;
}
