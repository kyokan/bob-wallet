require('./sentry');

const ipc = require('electron').ipcRenderer;
const FullNode = require('hsd/lib/node/fullnode');
const WalletPlugin = require('hsd/lib/wallet/plugin');
const Script = require('hsd/lib/script/script');
const remote = require('electron').remote;
const {hashName, types} = require('hsd/lib/covenants/rules');
const {Output, MTX, Address} = require('hsd/lib/primitives');

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
      workers: false,
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
      ipc.send('error', e);
    });
});

ipc.on('close', () => {
  if (!hsd) {
    return;
  }

  hsd.close()
    .then(() => remote.getCurrentWindow().close());
});

ipc.on('finalize-with-payment', (event, name, fundingAddr, nameReceiveAddr, price) => {
  (async () => {
    const {wdb} = hsd.require('walletdb');
    const wallet = await wdb.get('allison');
    const ns = await wallet.getNameStateByName(name);
    const owner = ns.owner;
    const coin = await wallet.getCoin(owner.hash, owner.index);
    const nameHash = hashName(name);

    const output0 = new Output();
    output0.value = coin.value;
    output0.address = new Address().fromString(nameReceiveAddr);
    output0.covenant.type = types.FINALIZE;
    output0.covenant.pushHash(nameHash);
    output0.covenant.pushU32(ns.height);
    output0.covenant.push(Buffer.from(name, 'ascii'));
    output0.covenant.pushU8(0); // flags, may be required if name was CLAIMed
    output0.covenant.pushU32(ns.claimed);
    output0.covenant.pushU32(ns.renewals);
    output0.covenant.pushHash(await wdb.getRenewalBlock());

    const output1 = new Output();
    output1.address = new Address().fromString(fundingAddr);
    output1.value = price;

    const mtx = new MTX();
    mtx.addCoin(coin);
    mtx.outputs.push(output0);
    mtx.outputs.push(output1);

    // Sign
    const rings = await wallet.deriveInputs(mtx);
    assert(rings.length === 1);
    const signed = await mtx.sign(
      rings,
      Script.hashType.SINGLEREVERSE | Script.hashType.ANYONECANPAY,
    );
    assert(signed === 1);

    assert(mtx.verify());
    return mtx.encode().toString('hex');
  })().then((hex) => {
    ipc.send('finalize-with-payment-reply', hex);
  }).catch((e) => {
    ipc.send('finalize-with-payment-reply', {
      error: e.message,
    });
  });
});

ipc.on('claim-paid-transfer', (event, txHex) => {
  (async () => {
    const {wdb} = hsd.require('walletdb');
    const wallet = await wdb.get('allison');
    const mtx = MTX.decode(Buffer.from(txHex, 'hex'));

    // Bob should verify all the data in the MTX to ensure everything is valid,
    // but this is the minimum.
    const input0 = mtx.input(0).clone(); // copy input with Alice's signature
    const coinEntry = await hsd.chain.db.readCoin(input0.prevout);
    assert(coinEntry); // ensures that coin exists and is still unspent

    const coin = coinEntry.toCoin(input0.prevout);
    assert(coin.covenant.type === types.TRANSFER);

    // Fund the TX.
    // The hsd wallet is not designed to handle partially-signed TXs
    // or coins from outside the wallet, so a little hacking is needed.
    const changeAddress = await wallet.changeAddress();
    const rate = await wdb.estimateFee();
    const coins = await wallet.getSmartCoins();
    // Add the external coin to the coin selector so we don't fail assertions
    coins.push(coin);
    await mtx.fund(coins, {changeAddress, rate});
    // The funding mechanism starts by wiping out existing inputs
    // which for us includes Alice's signature. Replace it from our backup.
    mtx.inputs[0].inject(input0);

    // Rearrange outputs.
    // Since we added a change output, the SINGELREVERSE is now broken:
    //
    // input 0: TRANSFER UTXO --> output 0: FINALIZE covenant
    // input 1: Bob's funds   --- output 1: payment to Alice
    //                 (null) --- output 2: change to Bob
    const outputs = mtx.outputs.slice();
    mtx.outputs = [outputs[0], outputs[2], outputs[1]];

    // Prepare to wait for mempool acceptance (race condition)
    const waiter = new Promise((resolve, reject) => {
      hsd.mempool.once('tx', resolve);
    });

    // Sign & Broadcast
    // Bob uses SIGHASHALL. The final TX looks like this:
    //
    // input 0: TRANSFER UTXO --> output 0: FINALIZE covenant
    // input 1: Bob's funds   --- output 1: change to Bob
    //                 (null) --- output 2: payment to Alice
    const tx = await wallet.sendMTX(mtx);
    assert(tx.verify(mtx.view));

    // Wait for mempool and check
    await waiter;
    assert(hsd.mempool.hasEntry(tx.hash()));
  })().then((hex) => {
    ipc.send('claim-paid-transfer-reply', {});
  }).catch((e) => {
    ipc.send('claim-paid-transfer-reply', {
      error: e.message,
    });
  });
});

function assert(value) {
  if (!value) {
    throw new Error('Assertion error.');
  }
}
