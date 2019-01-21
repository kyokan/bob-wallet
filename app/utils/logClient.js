import { clientStub } from '../background/logger';
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

// export const info = msg => {
//   return getClient()
//     .then(client => {
//       console.log('hi')
//       console.log(client)
//     });
// }
//
// async function getClient() {
//   return getClientStub()
//     .then(clientStub => clientStub(() => require('electron').ipcRenderer));
// }
