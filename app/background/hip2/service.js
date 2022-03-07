import { SET_HIP2_PORT } from "../../ducks/hip2Reducer";
import { get, put } from '../db/service';
import { dispatchToMainWindow } from "../../mainWindow";
const { fetchAddress, setServers } = require('hip2-dane');

const hip2Opts = {
  token: 'HNS',
  maxLength: 90,
  validate: key => !!key && key.slice(0,2) === 'hs' && key.length <= 90,
}

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
const methods = {
  getPort,
  setPort,
  fetchAddress: address => fetchAddress(address, hip2Opts),
  setServers,
};

export async function start (server) {
  server.withService(sName, methods)
};
