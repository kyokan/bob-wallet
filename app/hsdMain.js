require('./sentry');

const ipc = require('electron').ipcRenderer;
const FullNode = require('hsd/lib/node/fullnode');
const WalletPlugin = require('hsd/lib/wallet/plugin');
const remote = require('electron').remote;

let hsd = null;
ipc.on('start', (_, prefix, net, apiKey) => {
  if (hsd) {
    ipc.send('started');
    return;
  }

  try {
    // hsd = new FullNode({
    //   config: true,
    //   argv: true,
    //   env: true,
    //   logFile: true,
    //   logConsole: false,
    //   logLevel: 'debug',
    //   memory: false,
    //   workers: false,
    //   network: net,
    //   loader: require,
    //   prefix: prefix,
    //   listen: true,
    //   bip37: true,
    //   indexAddress: true,
    //   indexTX: true,
    //   apiKey,
    // });

    // hsd.use(WalletPlugin);
  } catch (e) {
    ipc.send('error', e);
    return;
  }

  hsd.ensure()
    .then(() => hsd.open())
    .then(() => ipc.send('started'))
    .then(() => hsd.connect())
    .then(() => hsd.startSync())
    .catch((e) => {
      console.log(e);
      ipc.send('error', e)
    });
});

ipc.on('close', () => {
  if (!hsd) {
    return;
  }

  hsd.close()
    .then(() => remote.getCurrentWindow().close());
});
