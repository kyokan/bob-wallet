# Security Policy

## Supported Versions

Please see [Releases](https://github.com/kyokan/bob-wallet/releases).  
We recommend using the [most recently released version](https://github.com/kyokan/bob-wallet/releases/latest).

## Reporting a Vulnerability

Please don't report security issues on GitHub. Instead, send an e-mail to dtsui [at] kyokan [dot] io (`4096R/395CD3B2`) describing your issue.

## Trusted PGP keys

The following keys may be used to sign release binaries:

| Name                                                             | Fingerprint                              | Full Key                        |
|------------------------------------------------------------------|------------------------------------------|---------------------------------|
| Matthew Slipper ([@mslipper](https://github.com/mslipper))       | 35C01D01A57FA04D9F2FF89DCB951614D58D3841 | https://keybase.io/mslipper     |
| Rithvik Vibhu ([@rithvikvibhu](https://github.com/rithvikvibhu)) | 0393D7636C08EFA8A781F9CDE85101DF1682E27F | https://keybase.io/rithvikvibhu |

You can also import a key by running the following command with an individual’s fingerprint:

`gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys "<fingerprint>"`

To import the full set:
```
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys "35C01D01A57FA04D9F2FF89DCB951614D58D3841"
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys "0393D7636C08EFA8A781F9CDE85101DF1682E27F"
```
