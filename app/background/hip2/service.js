import { SET_HIP2_PORT } from '../../ducks/hip2Reducer';
import { get, put } from '../db/service';
import { dispatchToMainWindow } from '../../mainWindow';
import { service } from '../node/service';
import { setServers, getAddress } from './hip2';
import isValidAddress from '../../utils/verifyAddress';

const HIP2_PORT = 'hip2/port';

async function getPort() {
  const hip2Port = await get(HIP2_PORT);
  if (hip2Port !== null) {
    return hip2Port;
  }

  return 9892;
}

async function setPort(port) {
  await put(HIP2_PORT, port);
  dispatchToMainWindow({
    type: SET_HIP2_PORT,
    payload: port
  });
}

async function fetchAddress(host) {
  const network = service.network.type;

  // Host should not be a Handshake address
  if (isValidAddress(host, network)) {
    const error = new Error('alias cannot be a valid address');
    error.code = 'ECOLLISION';
    throw error;
  }

  return await getAddress(host, network);
}

const sName = 'Hip2';

const methods = {
  getPort,
  setPort,
  fetchAddress,
  setServers,
};

export async function start(server) {
  server.withService(sName, methods);
}
