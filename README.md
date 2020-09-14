<p align="center"><img src="./resources/icons/128x128.png"></p>

# Bob: A Handshake Wallet and Full Node

Bob is a [Handshake](https://handshake.org) wallet with an integrated full node.
This is beta software.
(As with all wallet GUIs, please use with care, and at your own risk.)

## How to Install Bob

Most users (especially those who are unsure how to install Bob) should use the prebuilt binaries in this repo's [releases](https://github.com/kyokan/bob-wallet/releases) page.

![Screen Shot 2020-02-22 at 11 08 18 AM](https://user-images.githubusercontent.com/8230144/75097836-06f48480-5564-11ea-85db-64251184e7bf.png)

Note: this screenshot is unlikely to age well but the filetypes are highlighted so you know what to install. It says 0.2.6 here but you should always look for the latest version.
.dmg - mac
.msi - windows

### Linux

While not officially supported, you may wish to create a production build for your Linux machine.

```bash
git clone https://github.com/kyokan/bob-wallet
cd bob-wallet; npm install
```

Optionaly, Test it works before building

```bash
npm run dev
```

Latsly build the app package

```bash
npm run package-linux
``` 

The output app will be created in `/release` folder. Open `Bob-x.x.x.AppImage` to start the wallet.


## Features

Bob supports all of the following features:

1. Name auctions
2. DNS record management
3. Send/receive coins
![Screen Shot 2020-02-13 at 1 33 11 PM](https://user-images.githubusercontent.com/8230144/74480855-8a2c2100-4e66-11ea-9d29-63e474f47e23.png)
4. Airdrop claims
![Screen Shot 2020-02-13 at 1 33 32 PM](https://user-images.githubusercontent.com/8230144/74480849-87313080-4e66-11ea-8097-421592a9a55f.png)
5. Name watchlists
![Screen Shot 2020-02-13 at 1 32 49 PM](https://user-images.githubusercontent.com/8230144/74480856-8ac4b780-4e66-11ea-90c0-48c5444d0745.png)
6. Transferring names

## Contributing

Contributions are most welcome.  Some contributor activity occurs on [Telegram/bobwallet](https://t.me/bobwallet).

Inquires to integrate with hardware wallets, ecosystem DNS/website infrastructure, and offers to collaborate with other Handshake-aligned projects are also most welcome.  Please make inquiries via Telegram, to `[at]sdtsui`.

If you are an individual developer looking to add a feature, fix a bug, or create new documentation -- please feel free to reach out, even if just to say hello.  We are also exploring incentivization mechanisms, potentially ramping up from small bounties to ecosystem-funded full-time developers.

### Building From Source

Please see this [guide](https://gist.github.com/pinheadmz/314aed5123d29cb89bfc6a7db9f4d02e), courtesy of [@pinheadmz](https://github.com/pinheadmz).  It explains how to get set up in dev mode, and includes some helpful tips like (i) how to tail log output and (ii) how one can have a "personal mainnet" Bob while developing on a different Bob instance.

## Reporting Issues

**[DEPRECATED]** ~~Most discussion around Bob is on the [forum](https://forum.kyokan.io). Please go there to report issues and send feedback. The forum is also where we'll post announcements.~~

**We have no officially sanctioned or administered support/development channels, so this list will be periodically updated as the community develops. For now, the [Telegram/bobwallet](https://t.me/bobwallet) is the best place for questions.**

### Non-Security Issues

Please report issues on Github issues on this repo. Please file bugs with the provided template.

### Security Issues

Please don't report security issues on GitHub. Instead, send an e-mail to [security@kyokan.io](mailto:security@kyokan.io) describing your issue. Our PGP key's fingerprint is `9FDB 9D49 4A60 87E8 E61A 3F9E 2DCA AB4D D4B6 04F1`.
