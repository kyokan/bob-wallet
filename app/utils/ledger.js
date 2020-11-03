import { LedgerChange } from 'hsd-ledger';

export async function createLedgerChange(network, walletRPC, wid, mtx) {
  let i, key;

  for (i = mtx.outputs.length - 1; i >= 0; i--) {
    const output = mtx.outputs[i];
    const addr = output.address.toString(network.type);
    key = await walletRPC.getKey(wid, addr);

    if (key && key.branch)
      break;
  }

  const {account, branch, index} = key;
  const coinType = util.network.keyPrefix.coinType;
  return new LedgerChange({
    path: `m/44'/${coinType}'/${account}'/${branch}/${index}`,
    index: i,
    version: 0,
  });
}
