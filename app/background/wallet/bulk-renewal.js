const rules = require("hsd/lib/covenants/rules");
const { types } = rules;
const { states } = require("hsd/lib/covenants/namestate");
const MTX = require("hsd/lib/primitives/mtx");
const Output = require("hsd/lib/primitives/output");

export const createRenewMany = async (wallet, names) => {
  if (!Array.isArray(names)) {
    throw new Error("names must be an array");
  }

  const mtx = new MTX();

  for (const name of names) {
    if (!rules.verifyName(name)) {
      throw new Error("Invalid name.");
    }

    const rawName = Buffer.from(name, "ascii");
    const nameHash = rules.hashName(rawName);
    const ns = await wallet.getNameState(nameHash);
    const height = wallet.wdb.height + 1;
    const network = wallet.network;

    if (!ns) {
      throw new Error("Auction not found.");
    }

    const { hash, index } = ns.owner;
    const coin = await wallet.getCoin(hash, index);

    if (!coin) {
      throw new Error(`Wallet does not own: "${name}".`);
    }

    if (ns.isExpired(height, network)) throw new Error("Name has expired!");

    // Is local?
    if (coin.height < ns.height) {
      throw new Error(`Wallet does not own: "${name}".`);
    }

    const state = ns.state(height, network);

    if (state !== states.CLOSED) {
      throw new Error("Auction is not yet closed.");
    }

    if (
      !coin.covenant.isRegister() &&
      !coin.covenant.isUpdate() &&
      !coin.covenant.isRenew() &&
      !coin.covenant.isFinalize()
    ) {
      throw new Error("Name must be registered.");
    }

    if (height < ns.renewal + network.names.treeInterval) {
      throw new Error("Must wait to renew.");
    }

    const output = new Output();
    output.address = coin.address;
    output.value = coin.value;
    output.covenant.type = types.RENEW;
    output.covenant.pushHash(nameHash);
    output.covenant.pushU32(ns.height);
    output.covenant.pushHash(await wallet.wdb.getRenewalBlock());

    mtx.addOutpoint(ns.owner);
    mtx.outputs.push(output);
  }

  return mtx;
};
