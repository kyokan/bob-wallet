<p align="center"><img src="./resources/icons/128x128.png"></p>

# Bob: A Handshake Wallet and Full Node

Bob is a [Handshake](https://handshake.org) wallet with an integrated full node.

Most discussion around Bob is on the [forum](https://forum.kyokan.io). Please go there to report issues and send feedback. The forum is also where we'll post announcements.

**This is beta software, so use it at your own risk!** We expect to exit beta soon.

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

## Reporting Issues

### Non-Security Issues

Please report issues to the [#bob-support](https://forum.kyokan.io/c/bob/support/5) topic on our forum.  While this is preferred, the team sometimes responds to queries in our unofficial Telegram [channel](https://t.me/bobwallet).

### Security Issues

Please don't report security issues to GitHub. Instead, send an e-mail to [security@kyokan.io](mailto:security@kyokan.io) describing your issue. Our PGP key's fingerprint is `9FDB 9D49 4A60 87E8 E61A 3F9E 2DCA AB4D D4B6 04F1`.

## Contributing

### Building From Source

To build Bob from source, clone the repo and run `npm install`. Then, run `npm run dev` to start a local development server. Note that changes to code running in Electron's main process will require a restart of the development server.

To package the application for Mac, run `npm run package`. This will create a DMG and app bundle. Similarly, to bundle for Windows or Linux run `npm run package-win` or `npm run package-linux`, respectively.
