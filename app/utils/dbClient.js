import { clientStub as dbClientStub } from '../background/db/client';

const db = dbClientStub(() => require('electron').ipcRenderer);

const dbClient = {
  addName: async (net, hash, name) => {
    return db.addName(net, hash, name);
  },

  getName: async (net, hash) => {
    return db.getName(net, hash);
  },
};

export default dbClient;
