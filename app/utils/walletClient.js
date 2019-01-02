import { WalletClient } from 'hs-client';
const Network = require('hsd/lib/protocol/network');

const network = Network.get('simnet');

export const getNetwork = () => {
  // console.log(network);
};

export const createWallet = () => {
  let id, passphrase, witness, watchOnly, accountKey;

  id = 'Kyokan1';
  passphrase = 'secret456';
  witness = false;
  watchOnly = false;
  // accountKey =
  //   'spubKBAoFrCN1HzSEDye7jcQaycA8L7MjFGmJD1uuvUZ21d9srAmAxmB7o1tCZRyXmTRuy5ZDQDV6uxtcxfHAadNFtdK7J6RV9QTcHTCEoY5FtQD';

  const walletOptions = {
    network: network.type,
    port: network.walletPort,
    apiKey: 'api-key'
  };

  const walletClient = new WalletClient(walletOptions);

  const options = {
    passphrase: passphrase,
    witness: witness,
    watchOnly: watchOnly,
    accountKey: accountKey
  };

  (async () => {
    const result = await walletClient.createWallet(id, options);
    console.log(result);
  })();
};

// class WalletClient {
//   constructor() {
//     this.url = 'http://127.0.0.1';
//     this.walletPort = '15039';
//     this.walletBase = `${this.url}:${this.walletPort}/wallet`;
//   }

//   async createNewWallet(id) {
//     const resp = await fetch(`${this.walletBase}/${id}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({})
//     });
//     const json = await resp.json();
//     return json;
//   }

//   // note: returns mnemonic phrases if wallet is unencrypted
//   async getMasterHDKey(id) {
//     const resp = await fetch(`${this.walletBase}/${id}/master`);
//     const json = await resp.json();
//     return json;
//   }

//   async changePassphrase(id, newPassphrase, oldPassphrase = '') {
//     const options = { passphrase: newPassphrase };

//     !!oldPassphrase && (options['old'] = oldPassphrase);

//     const resp = await fetch(`${this.walletBase}/${id}/passphrase`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(options)
//     });
//     const json = await resp.json();
//     return json;
//   }

//   async generateReceivingAddress(id, account = 'default') {
//     const resp = await fetch(`${this.walletBase}/${id}/address`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ account })
//     });
//     const json = await resp.json();
//     return json;
//   }

//   // note: bech32EncodedAddress === receivingAddress
//   async getPublicKeyByAddress(id, bech32EncodedAddress) {
//     const resp = await fetch(
//       `${this.walletBase}/${id}/key/${bech32EncodedAddress}`
//     );
//     const json = await resp.json();
//     return json;
//   }

//   async getPrivateKeyByAddress(id, bech32EncodedAddress, passphrase) {
//     const resp = await fetch(
//       `${
//         this.walletBase
//       }/${id}/wif/${bech32EncodedAddress}?passphrase=${passphrase}`
//     );
//     const json = await resp.json();
//     return json;
//   }
// }

// export default new WalletClient();
