import { clientStub } from '../background/hip2/client'

const hip2Client = clientStub(() => require('electron').ipcRenderer)

export default hip2Client
