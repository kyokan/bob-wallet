/*!
 * goosig.js - groups of unknown order for javascript
 * Copyright (c) 2018, Christopher Jeffrey (MIT License).
 * https://github.com/handshake-org/goosig
 *
 * Parts of this software are based on kwantam/libGooPy:
 *   Copyright (c) 2018, Dan Boneh, Riad S. Wahby (Apache License).
 *   https://github.com/kwantam/GooSig
 */

/*
This file stubs out the goosig dependency in HSD so that it
can compile in webpack/babel. It doesn't compile without this
modification due to usage of native JavaScript BigInts, which don't
have a usable Babel transform yet.
 */

'use strict';

module.exports = function GoosigStub() {};
