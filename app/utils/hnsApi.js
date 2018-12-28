class API {
  constructor() {
    this.url = 'http://127.0.0.1';
    this.walletPort = '15039';
    this.walletBase = `${this.url}:${this.walletPort}/wallet`;
  }

  async createNewWallet(id) {
    const resp = await fetch(`${this.walletBase}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const json = await resp.json();
    return json;
  }

  // note: returns mnemonic phrases if wallet is unencrypted
  async getMasterHDKey(id) {
    const resp = await fetch(`${this.walletBase}/${id}/master`);
    const json = await resp.json();
    return json;
  }

  async changePassphrase(id, newPassphrase, oldPassphrase = '') {
    const options = { passphrase: newPassphrase };

    !!oldPassphrase && (options['old'] = oldPassphrase);

    const resp = await fetch(`${this.walletBase}/${id}/passphrase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    const json = await resp.json();
    return json;
  }

  async generateReceivingAddress(id, account = 'default') {
    const resp = await fetch(`${this.walletBase}/${id}/address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account })
    });
    const json = await resp.json();
    return json;
  }

  // note: bech32EncodedAddress === receivingAddress
  async getPublicKeyByAddress(id, bech32EncodedAddress) {
    const resp = await fetch(
      `${this.walletBase}/${id}/key/${bech32EncodedAddress}`
    );
    const json = await resp.json();
    return json;
  }

  async getPrivateKeyByAddress(id, bech32EncodedAddress, passphrase) {
    const resp = await fetch(
      `${
        this.walletBase
      }/${id}/wif/${bech32EncodedAddress}?passphrase=${passphrase}`
    );
    const json = await resp.json();
    return json;
  }
}

export default new API();
