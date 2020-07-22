import { del, get, put } from '../db/service';
import crypto from "crypto";

const CONNECTION_TYPE_KEY = 'connection_type';
const RPC_API_KEY = 'p2p_api_key';
const CUSTOM_RPC_HOST = 'custom_rpc_host';
const CUSTOM_RPC_PORT = 'custom_rpc_port';
const CUSTOM_RPC_NETWORK_TYPE = 'custom_rpc_network_type';
const CUSTOM_RPC_API_KEY = 'custom_rpc_api_key';

const Network = require('hsd/lib/protocol/network');

export const ConnectionTypes = {
  P2P: 'P2P',
  Custom: 'Custom',
};

export async function getAPIKey() {
  const apiKey = await get(RPC_API_KEY);

  if (!apiKey) {
    const key = crypto.randomBytes(20).toString('hex');
    await put(RPC_API_KEY, key);
    return key;
  }

  return apiKey;
}

export async function getCustomRPC() {
  const host = await get(CUSTOM_RPC_HOST);
  const port = await get(CUSTOM_RPC_PORT);
  const networkType = await get(CUSTOM_RPC_NETWORK_TYPE);
  const apiKey = await get(CUSTOM_RPC_API_KEY);

  return {
    host,
    port,
    networkType,
    apiKey,
  };
}

async function setConnection(opts) {
  switch (opts.type) {
    case ConnectionTypes.P2P:
      await put(CONNECTION_TYPE_KEY, ConnectionTypes.P2P);
      return;
    case ConnectionTypes.Custom:
      await put(CONNECTION_TYPE_KEY, ConnectionTypes.Custom);
      await put(CUSTOM_RPC_HOST, opts.host || '');
      await put(CUSTOM_RPC_PORT, opts.port || '');
      await put(CUSTOM_RPC_NETWORK_TYPE, opts.networkType || '');
      await put(CUSTOM_RPC_API_KEY, opts.apiKey || '');
      return;
    default:
      throw new Error(`unknown connection type ${opts.type}`);
  }
}

async function setConnectionType(connectionType) {
  return await put(CONNECTION_TYPE_KEY, connectionType);
}

export async function getConnection() {
  const connectionType = await get(CONNECTION_TYPE_KEY);

  switch (connectionType) {
    case ConnectionTypes.Custom:
      const customRpc = await getCustomRPC();
      return {
        type: ConnectionTypes.Custom,
        ...customRpc,
      };
    case ConnectionTypes.P2P:
      return {
        type: ConnectionTypes.P2P,
        apiKey: await getAPIKey(),
      };
    default:
      return {
        type: ConnectionTypes.P2P,
        apiKey: await getAPIKey(),
      };
  }
}

const sName = 'Connections';
const methods = {
  getConnection,
  setConnection,
  setConnectionType,
  getCustomRPC,
};

export async function start(server) {
  server.withService(sName, methods);
}

