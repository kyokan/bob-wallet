#  Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Fix the GitHub link on the Add Funds screen
- `hsd` updated to latest pre-mainnet version
- Record management updated to reflect latest `hsd` changes
    - All record types except `NS`, `DS`, `GLUE4/6`, `SYNTH4/6`, and `TXT` have been removed

## [0.1.1] - 2020-01-22

- Fix broken `isDev` flag in analytics service.
- Bump `webpack-bundle-analyzer` in response to automatic security vuln [PR #78](https://github.com/kyokan/bob-wallet/pull/78)
    - NOTE: This vulnerability does not affect production Bob clients, since `webpack-bundle-analyzer` is only used for internal build tooling.  

## [0.1.0] - 2020-01-21
### Added

- Initial public beta release
