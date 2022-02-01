import { clientStub } from '../background/setting/client';

const settingsClient = clientStub(() => require('electron').ipcRenderer);

export default settingsClient;
