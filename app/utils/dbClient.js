import { clientStub } from '../background/db/client';

const dbClient = clientStub(() => require('electron').ipcRenderer);

export default dbClient;
