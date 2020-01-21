import electron from 'electron'

// Taken from https://github.com/sindresorhus/electron-is-dev/blob/master/index.js
// because tiny dependencies like this one are easier to inline.
const app = electron.app || electron.remote.app;

const isEnvSet = 'ELECTRON_IS_DEV' in process.env;
const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;

const _isDev = isEnvSet ? getFromEnv : !app.isPackaged;

export default function isDev() {
  return _isDev;
}
