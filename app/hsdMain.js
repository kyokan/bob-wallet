require('./sentry');

const ipc = require('electron').ipcRenderer;
const FullNode = require('hsd/lib/node/fullnode');
const WalletPlugin = require('hsd/lib/wallet/plugin');
const WorkerPool = require('./workers/workerpool');
const remote = require('electron').remote;

let hsd = null;
ipc.on('start', (_, prefix, net, apiKey) => {
  if (hsd) {
    ipc.send('started');
    return;
  }

  try {
    hsd = new FullNode({
      config: true,
      argv: true,
      env: true,
      logFile: true,
      logConsole: false,
      logLevel: 'debug',
      memory: false,
      network: net,
      loader: require,
      prefix: prefix,
      listen: true,
      bip37: true,
      indexAddress: true,
      indexTX: true,
      apiKey,
    });

    hsd.use(WalletPlugin);

    // Stub the hsd FullNode WorkerPool module with our own,
    // and re-bind the event listeners. See hsd/lib/node/node.js _init()
    hsd.workers = new WorkerPool({
      enabled: true
    });
    hsd.chain.workers = hsd.workers;
    hsd.mempool.workers = hsd.workers;
    hsd.miner.workers = hsd.workers;
    hsd.workers.on('spawn', (child) => {
      hsd.logger.info('Spawning worker process: %d.', child.id);
    });
    hsd.workers.on('exit', (code, child) => {
      hsd.logger.warning('Worker %d exited: %s.', child.id, code);
    });
    hsd.workers.on('log', (text, child) => {
      hsd.logger.debug('Worker %d says:', child.id);
      hsd.logger.debug(text);
    });
    hsd.workers.on('error', (err, child) => {
      if (child) {
        hsd.logger.error('Worker %d error: %s', child.id, err.message);
        return;
      }
      hsd.emit('error', err);
    });
  } catch (e) {
    ipc.send('error', e);
    return;
  }

  hsd.ensure()
    .then(() => hsd.open())
    .then(() => hsd.connect())
    .then(() => hsd.startSync())
    .then(() => ipc.send('started'))
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
