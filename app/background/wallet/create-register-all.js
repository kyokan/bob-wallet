const MTX = require('hsd/lib/primitives/mtx');
const {states} = require('hsd/lib/covenants/namestate');
const rules = require('hsd/lib/covenants/rules');
const {types} = rules;
const Output = require('hsd/lib/primitives/output');
const EMPTY = Buffer.alloc(0);

export default async function createRegisterAll(wallet) {
  const height = wallet.wdb.height + 1;
  const network = wallet.network;
  const names = await wallet.txdb.getNames();
  const mtx = new MTX();

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

      const output = new Output();
      output.address = coin.address;
      output.value = ns.value;

      output.covenant.type = types.REGISTER;
      output.covenant.pushHash(ns.nameHash);
      output.covenant.pushU32(ns.height);
      output.covenant.push(EMPTY);
      output.covenant.pushHash(await wallet.wdb.getRenewalBlock());

      mtx.addOutpoint(ns.owner);
      mtx.outputs.push(output);
    }
  }

  if (mtx.outputs.length === 0)
    throw new Error('No reveals to register.');

  return mtx;
}
