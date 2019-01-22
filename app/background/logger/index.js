import { defaultServer, makeClient } from '../ipc';
import * as logger from './logger';

export async function info(msg) {
  logger.info(msg);
}

export async function warn(msg) {
  logger.warn(msg);
}

export async function error(msg) {
  logger.error(msg);
}

export async function log() {
  logger.log(...arguments);
}

async function download() {
  return logger.download();
}

const sName = 'Logger';
const methods = {
  info,
  warn,
  error,
  log,
  download,
};

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, sName, Object.keys(methods));
defaultServer.withService(sName, methods);
