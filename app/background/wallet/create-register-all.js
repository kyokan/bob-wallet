const {states} = require('hsd/lib/covenants/namestate');


/** @param {import('hsd/lib/wallet/wallet')} wallet */
export const getNamesForRegisterAll = async (wallet) => {
  const height = wallet.wdb.height + 1;
  const network = wallet.network;
  const names = await wallet.txdb.getNames();
  const namesToRegister = [];

  for (let i = 0; i < names.length; i++) {
    const ns = names[i];
    const {owner} = ns;

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

      namesToRegister.push(Buffer.from(ns.name, 'hex').toString('ascii'));
    }
  }

  return namesToRegister;
}
