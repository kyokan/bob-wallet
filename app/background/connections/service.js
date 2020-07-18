import { del, get, put } from '../db/service';
import crypto from "crypto";

const CONNECTION_TYPE_KEY = 'connection_type';
const RPC_API_KEY = 'p2p_api_key';
const CUSTOM_RPC = 'custom_rpc';

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
  const network = Network.get('main');
  const customRPC = await get(CUSTOM_RPC);

  try {
    const { host, port, networkType, apiKey } = JSON.parse(customRPC);
    return {
      host,
      port,
      networkType,
      apiKey,
    };
  } catch (e) {
    return {
      host: '127.0.0.1',
      port: network.rpcPort,
      networkType: network.type,
    };
  }
}

async function setConnection(type, args = {}) {
  switch (type) {
    case ConnectionTypes.P2P:
      await put(CONNECTION_TYPE_KEY, type);
      return;
    case ConnectionTypes.Custom:
      await put(CONNECTION_TYPE_KEY, type);
      await put(CUSTOM_RPC, JSON.stringify({
        host: args.host,
        port: args.port,
        networkType: args.networkType,
        apiKey: args.apiKey,
      }));
      return;
    default:
      throw new Error(`unknown connection type ${type}`);
  }
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
};

export async function start(server) {
  server.withService(sName, methods);
}

