const Address = require('hsd/lib/primitives/address');
const rules = require('hsd/lib/covenants/rules');
const {types} = rules;
const {states} = require('hsd/lib/covenants/namestate');
const MTX = require('hsd/lib/primitives/mtx');
const Output = require('hsd/lib/primitives/output');

export const transferMany = async (wallet, names, recipientAddress) => {
  if (!Array.isArray(names)) {
    throw new Error('names must be an array');
  }

  const address = new Address(recipientAddress, wallet.network);
  const mtx = new MTX();

  for (const name of names) {
    if (!rules.verifyName(name))
      throw new Error('Invalid name.');

    const rawName = Buffer.from(name, 'ascii');
    const nameHash = rules.hashName(rawName);
    const ns = await wallet.getNameState(nameHash);
    const height = wallet.wdb.height + 1;
    const network = wallet.network;

    if (!ns)
      throw new Error('Auction not found.');

    const {hash, index} = ns.owner;
    const coin = await wallet.getCoin(hash, index);

    if (!coin)
      throw new Error(`Wallet does not own: "${name}".`);

    if (ns.isExpired(height, network))
      throw new Error('Name has expired!');

    // Is local?
    if (coin.height < ns.height)
      throw new Error(`Wallet does not own: "${name}".`);

    const state = ns.state(height, network);

    if (state !== states.CLOSED)
      throw new Error('Auction is not yet closed.');

    if (!coin.covenant.isRegister()
      && !coin.covenant.isUpdate()
      && !coin.covenant.isRenew()
      && !coin.covenant.isFinalize()) {
      throw new Error('Name must be registered.');
    }

    const output = new Output();
    output.address = coin.address;
    output.value = coin.value;
    output.covenant.type = types.TRANSFER;
    output.covenant.pushHash(nameHash);
    output.covenant.pushU32(ns.height);
    output.covenant.pushU8(address.version);
    output.covenant.push(address.hash);

    mtx.addOutpoint(ns.owner);
    mtx.outputs.push(output);
  }

  const unlock = await wallet.fundLock.lock();
  try {
    await wallet.fill(mtx);
    const finalizedTX = await wallet.finalize(mtx);
    await wallet.sendMTX(finalizedTX, null);
  } finally {
    unlock();
  }
};

export const finalizeMany = async (wallet, names) => {
  if (!Array.isArray(names)) {
    throw new Error('names must be an array');
  }

  const mtx = new MTX();

  for (const name of names) {
    if (!rules.verifyName(name))
      throw new Error('Invalid name.');

    const rawName = Buffer.from(name, 'ascii');
    const nameHash = rules.hashName(rawName);
    const ns = await wallet.getNameState(nameHash);
    const height = wallet.wdb.height + 1;
    const network = wallet.network;

    if (!ns)
      throw new Error('Auction not found.');

    const {hash, index} = ns.owner;
    const coin = await wallet.getCoin(hash, index);

    if (!coin)
      throw new Error(`Wallet does not own: "${name}".`);

    if (ns.isExpired(height, network))
      throw new Error('Name has expired!');

    // Is local?
    if (coin.height < ns.height)
      throw new Error(`Wallet does not own: "${name}".`);

    const state = ns.state(height, network);

    if (state !== states.CLOSED)
      throw new Error('Auction is not yet closed.');

    if (!coin.covenant.isTransfer())
      throw new Error('Name is not being transfered.');

    if (height < coin.height + network.names.transferLockup)
      throw new Error('Transfer is still locked up.');

    const version = coin.covenant.getU8(2);
    const addr = coin.covenant.get(3);
    const address = Address.fromHash(addr, version);

    let flags = 0;

    if (ns.weak)
      flags |= 1;

    const output = new Output();
    output.address = address;
    output.value = coin.value;
    output.covenant.type = types.FINALIZE;
    output.covenant.pushHash(nameHash);
    output.covenant.pushU32(ns.height);
    output.covenant.push(rawName);
    output.covenant.pushU8(flags);
    output.covenant.pushU32(ns.claimed);
    output.covenant.pushU32(ns.renewals);
    output.covenant.pushHash(await wallet.wdb.getRenewalBlock());

    mtx.addOutpoint(ns.owner);
    mtx.outputs.push(output);
  }

  const unlock = await wallet.fundLock.lock();
  try {
    await wallet.fill(mtx);
    const finalizedTX = await wallet.finalize(mtx);
    await wallet.sendMTX(finalizedTX, null);
  } finally {
    unlock();
  }
};
