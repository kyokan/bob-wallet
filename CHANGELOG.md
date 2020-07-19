#  Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Fixed
- Fixed long startup times by not waiting for the node to open connections or start sync before
  registering the node as started.

## [0.4.0] - 2020-07-05
### Added
- Added the ability to initiate transfers from the Bob UI

## [0.3.0] - 2020-06-08
### Fixed
- Fixed total amount received by a transaction with multiple outputs to the wallet
- Fixed sluggish UI from mass of redundant rpc calls on "Your Bids" view
- Fixed a bug where lots of names would not appear

### Added
- Added warning for missing bid values and functionality to repair missing bids
- Added wallet action in Settings page to delete unconfirmed transactions
- Added "Rescan Auction" button to import name into wallet and discover existing bids
- Automatically rescan auction if a user bids on a name that is not already in the wallet
- Introduce "Wallet Sync" modal that blocks UI and displays wallet rescan progress

### Changed
- Switch bcrypto backend to native for remarkable performance improvements
- Total Balance is now the "unconfirmed" balance from hsd. Unlocked balance is replaced
with "spendable" balance which is total unconfirmed minus total locked coins
- Covenants in portfolio view now display their value as it affects spendable balance
- Improvements to maxSend based on spendable balance and cleaner fee estimation
- Bob will ask user for passphrase whenever private key is needed (e.g. send TX)
- Bob will no longer "logout" when underlying hsd wallet is locked, however
Bob will still lock the hsd wallet on logout or idle timeout

## [0.2.8] - 2020-03-17
### Fixed
- Fixed a crash when names transitioned from the bidding to revealing state

## [0.2.7] - 2020-03-16
### Added
- Added an additional warning to the reset screen to highlight how bids need to be re-imported after deleting a wallet
- Added an HNScan link to the transaction confirmation dialog

### Fixed
- Fixed date calculations on auction screens
- Fixed auction pages to show "Coming Soon" when auctions aren't available yet
- Fixed copy on the "Get Coins" screen to accurately reflect when the [hs-airdrop](https://github.com/handshake-org/hs-airdrop) snapshot was taken

### Changed
- Leading and trailing whitespace is now removed before verifying seed phrases
- Updated copy on the auctions screen to say "Your Bids," rather than "Bid History," which more accurately reflects the data being displayed

### Removed
- Removed broken "add to calendar" functionality

## [0.2.6] - 2020-02-14
### Added
- Added a feature to specify custom fee rates
- Added links to HNScan on the transactions page

## [0.2.5] - 2020-02-14
### Fixed
- Fixed an error in which balances did not automatically update on the account screen

### Changed
- Changed fee estimation screen to properly account for how the fee is a rate, not a flat fee per transaction 

## [0.2.4] - 2020-02-14
### Fixed
- Upgraded HSD to a version without mempool issues 

## [0.2.3] - 2020-02-11
### Changed
- Disable airdrop functionality until block 2016
- Made transaction activation alerts dynamic
- Made node start/stop functionality node robust

### Fixed
- Fixed a crash while updating domain name records
- Fixed various minor copy issues

## [0.2.2] - 2020-02-10
### Fixed
- Fixed an issue where chainstate was wiped when mainnet wallets are reset. This means that Bob no longer needs to perform a sync from zero after resetting mainnet wallets
- Fixed an issue where Windows machines might time out restarting Bob
- Fixed an issue where the error displayed when `hsd`'s ports are in use displayed as `undefined` on the splash screen 

## [0.2.1] - 2020-02-03
### Fixed
- Fixed an issue where mainnet wallets could not be regenerated

## [0.2.0] - 2020-02-03
### Added
- Enabled mainnet/testnet networks
- Added support for Windows
- Added a message alerting users that transactions are disabled for the first two weeks following mainnet

### Changed
- `hsd` updated to latest pre-mainnet version
- Record management updated to reflect latest `hsd` changes
    - All record types except `NS`, `DS`, `GLUE4/6`, `SYNTH4/6`, and `TXT` have been removed
- Removed some unused internal methods
- Added release information to Sentry
- Log application crashes on startup to Sentry

### Fixed
- Fix the GitHub link on the Add Funds screen
- Fixed transaction ordering
- Increase FS lock detection timeout

## [0.1.1] - 2020-01-22
### Fixed
- Fixed broken `isDev` flag in analytics service.

### Changed
- Bump `webpack-bundle-analyzer` in response to automatic security vuln [PR #78](https://github.com/kyokan/bob-wallet/pull/78)
    - NOTE: This vulnerability does not affect production Bob clients, since `webpack-bundle-analyzer` is only used for internal build tooling.  

## [0.1.0] - 2020-01-21
### Added

- Initial public beta release
