import { clientStub } from '../background/logger/client';

const logClient = clientStub(() => require('electron').ipcRenderer);

export const info = msg => {
  logClient.info(msg);
};

export const warn = msg => {
  logClient.warn(msg);
};

export const error = msg => {
  logClient.error(msg);
};

export const log = () => {
  logClient.info(...arguments);
};

export const download = async (network, savePath) => {
  return await logClient.download(network, savePath);
};
