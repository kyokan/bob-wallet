import { SET_HIP2_PORT } from '../../ducks/hip2Reducer';
import { get, put } from '../db/service';
import { dispatchToMainWindow } from '../../mainWindow';
import { service } from '../node/service';
const { fetchAddress, setServers } = require('hip2-dane');

const HIP2_PORT = 'hip2/port';

async function getPort () {
  const hip2Port = await get(HIP2_PORT);
  if (hip2Port !== null) {
    return hip2Port;
  }

  return 9892;
}

async function setPort (port) {
  await put(HIP2_PORT, port);
  dispatchToMainWindow({
    type: SET_HIP2_PORT,
    payload: port
  });
}

const sName = 'Hip2';

const networkPrefix = {
  simnet: 'ss1',
  testnet: 'ts1',
  main: 'hs1',
  regtest: 'rs1'
};

const methods = {
  getPort,
  setPort,
  fetchAddress: async address => await fetchAddress(address, {
    token: 'HNS',
    maxLength: 90,
    validate: addr => {
      return typeof addr === 'string' && addr.slice(0, 3) === networkPrefix[service.network.type];
    }
  }),
  setServers
};

export async function start (server) {
  server.withService(sName, methods);
}
