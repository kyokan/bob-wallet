import { SET_HIP2_PORT } from "../../ducks/hip2Reducer";
import { get, put } from '../db/service';
import { dispatchToMainWindow } from "../../mainWindow";
import { service } from "../node/service"
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
    payload: port,
  });
}

const sName = 'Hip2'

const networkPrefix = {
  simnet: 'ss',
  testnet: 'ts',
  main: 'hs',
  regtest: 'rs',
};

export async function start (server) {
  const methods = {
    getPort,
    setPort,
    fetchAddress: async address => await fetchAddress(address, {
      token: 'HNS',
      maxLength: 90,
      validate: key => {
        return key.length
          && key.slice(0,2) === networkPrefix[service.network.type]
          && key.length >= 9
          && key.length <= 90 
      }
    }),
    setServers,
  };
  server.withService(sName, methods)
};