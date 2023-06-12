const { states } = require('hsd/lib/covenants/namestate');

// From hsd/lib/wallet/wallet.js make*()

/** @param {import('hsd/lib/wallet/wallet')} wallet */
export const getNamesForRegisterAll = async (wallet) => {
  const height = wallet.wdb.height + 1;
  const network = wallet.network;
  const names = await wallet.txdb.getNames();
  const namesToRegister = [];

  for (let i = 0; i < names.length; i++) {
    const ns = names[i];
    const { owner } = ns;

    const coin = await wallet.getUnspentCoin(owner.hash, owner.index);

    if (coin) {
      if (!coin)
        continue;

      if (ns.isExpired(height, network))
        continue;

      // Is local?
      if (coin.height < ns.height)
        continue;

      if (!coin.covenant.isReveal() && !coin.covenant.isClaim())
        continue;

      if (coin.covenant.isClaim()) {
        if (height < coin.height + network.coinbaseMaturity)
          continue;
      }

      const state = ns.state(height, network);

      if (state !== states.CLOSED)
        continue;

      namesToRegister.push({
        name: ns.name.toString('binary'),
      });
    }
  }

  return namesToRegister;
}

/** @param {import('hsd/lib/wallet/wallet')} wallet */
export const getNamesForFinalizeAll = async (wallet) => {
  const height = wallet.wdb.height + 1;
  const network = wallet.network;
  const names = await wallet.txdb.getNames();
  const namesToFinalize = [];

  for (const ns of names) {
    // Easiest check is for transfer state, do that first
    if (!ns.transfer)
      continue;

    const blocksLeft = (ns.transfer + network.names.transferLockup) - height;
    if (blocksLeft > 0)
      continue;

    // Then check for expiration
    if (ns.isExpired(height, network))
      continue;

    // Now do the db lookups to see if we own the name
    const { hash, index } = ns.owner;
    const coin = await wallet.getUnspentCoin(hash, index);
    if (!coin)
      continue;

    namesToFinalize.push({
      name: ns.name.toString('binary'),
      finalizableSinceBlocks: -blocksLeft,
    });
  }

  return namesToFinalize;
}

/** @param {import('hsd/lib/wallet/wallet')} wallet */
export const getNamesForRenewAll = async (wallet) => {
  const height = wallet.wdb.height + 1;
  const network = wallet.network;
  const names = await wallet.txdb.getNames();
  const namesToRenew = [];

  for (const ns of names) {
    // Easiest check is for expiring time, do that first
    if (ns.isExpired(height, network))
      continue;

    // About 90 days on main (1.75 years after REGISTER)
    // 625 blocks on regtest (4375 blocks after REGISTER)
    const blocksLeft = (ns.renewal + network.names.renewalWindow) - height;
    if (blocksLeft >= network.names.renewalWindow / 8)
      continue;

    if (height < ns.renewal + network.names.treeInterval)
      continue; // Can not renew yet

    // Now do the db lookups to see if we own the name
    const { hash, index } = ns.owner;
    const coin = await wallet.getUnspentCoin(hash, index);
    if (!coin)
      continue;

    if (!coin.covenant.isRegister()
      && !coin.covenant.isUpdate()
      && !coin.covenant.isRenew()
      && !coin.covenant.isFinalize()) {
      continue; // Name is not yet registered
    }

    namesToRenew.push({
      name: ns.name.toString('binary'),
      renewInBlocks: blocksLeft,
    });
  }

  // Sort by urgency, oldest/lowest renewal heights go first
  namesToRenew.sort((a, b) => {
    return a.blocksLeft - b.blocksLeft;
  });

  return namesToRenew;
}

/** @param {import('hsd/lib/wallet/wallet')} wallet */
export const getNamesInTransfer = async (wallet) => {
  const height = wallet.wdb.height + 1;
  const network = wallet.network;
  const names = await wallet.txdb.getNames();
  const namesInTransfer = [];

  for (const ns of names) {
    // Easiest check is for transfer state, do that first
    if (!ns.transfer)
      continue;

    const blocksLeft = (ns.transfer + network.names.transferLockup) - height;
    if (blocksLeft <= 0)
      continue;

    // Then check for expiration
    if (ns.isExpired(height, network))
      continue;

    // Now do the db lookups to see if we own the name
    const { hash, index } = ns.owner;
    const coin = await wallet.getUnspentCoin(hash, index);
    if (!coin)
      continue;

    namesInTransfer.push({
      name: ns.name.toString('binary'),
      finalizableInBlocks: blocksLeft,
    });
  }

  return namesInTransfer;
}
