/*!
 * parser.js - worker parser for hsd
 * Copyright (c) 2017-2018, Christopher Jeffrey (MIT License).
 * https://github.com/handshake-org/hsd
 */

'use strict';

const assert = require('bsert');
const EventEmitter = require('events');
const packets = require('./packets');

/**
 * Parser
 * @alias module:workers.Parser
 * @extends EventEmitter
 */

class Parser extends EventEmitter {
  /**
   * Create a parser.
   * @constructor
   */

  constructor() {
    super();

    this.waiting = 9;
    this.header = null;
    this.pending = [];
    this.total = 0;
  }

  feed(data) {
    this.total += data.length;
    this.pending.push(data);

    while (this.total >= this.waiting) {
      const chunk = this.read(this.waiting);
      this.parse(chunk);
    }
  }

  read(size) {
    assert(this.total >= size, 'Reading too much.');

    if (size === 0)
      return Buffer.alloc(0);

    const pending = this.pending[0];

    if (pending.length > size) {
      const chunk = pending.slice(0, size);
      this.pending[0] = pending.slice(size);
      this.total -= chunk.length;
      return chunk;
    }

    if (pending.length === size) {
      const chunk = this.pending.shift();
      this.total -= chunk.length;
      return chunk;
    }

    const chunk = Buffer.allocUnsafe(size);
    let off = 0;

    while (off < chunk.length) {
      const pending = this.pending[0];
      const len = pending.copy(chunk, off);
      if (len === pending.length)
        this.pending.shift();
      else
        this.pending[0] = pending.slice(len);
      off += len;
    }

    assert.strictEqual(off, chunk.length);

    this.total -= chunk.length;

    return chunk;
  }

  parse(data) {
    let header = this.header;

    if (!header) {
      try {
        header = this.parseHeader(data);
      } catch (e) {
        this.emit('error', e);
        return;
      }

      this.header = header;
      this.waiting = header.size + 1;

      return;
    }

    this.waiting = 9;
    this.header = null;

    let packet;
    try {
      packet = this.parsePacket(header, data);
    } catch (e) {
      this.emit('error', e);
      return;
    }

    if (data[data.length - 1] !== 0x0a) {
      this.emit('error', new Error('No trailing newline.'));
      return;
    }

    packet.id = header.id;

    this.emit('packet', packet);
  }

  parseHeader(data) {
    const id = data.readUInt32LE(0, true);
    const cmd = data.readUInt8(4, true);
    const size = data.readUInt32LE(5, true);
    return new Header(id, cmd, size);
  }

  parsePacket(header, data) {
    switch (header.cmd) {
      case packets.types.ENV:
        return packets.EnvPacket.decode(data);
      case packets.types.EVENT:
        return packets.EventPacket.decode(data);
      case packets.types.LOG:
        return packets.LogPacket.decode(data);
      case packets.types.ERROR:
        return packets.ErrorPacket.decode(data);
      case packets.types.ERRORRESULT:
        return packets.ErrorResultPacket.decode(data);
      case packets.types.CHECK:
        return packets.CheckPacket.decode(data);
      case packets.types.CHECKRESULT:
        return packets.CheckResultPacket.decode(data);
      case packets.types.SIGN:
        return packets.SignPacket.decode(data);
      case packets.types.SIGNRESULT:
        return packets.SignResultPacket.decode(data);
      case packets.types.CHECKINPUT:
        return packets.CheckInputPacket.decode(data);
      case packets.types.CHECKINPUTRESULT:
        return packets.CheckInputResultPacket.decode(data);
      case packets.types.SIGNINPUT:
        return packets.SignInputPacket.decode(data);
      case packets.types.SIGNINPUTRESULT:
        return packets.SignInputResultPacket.decode(data);
      case packets.types.ECVERIFY:
        return packets.ECVerifyPacket.decode(data);
      case packets.types.ECVERIFYRESULT:
        return packets.ECVerifyResultPacket.decode(data);
      case packets.types.ECSIGN:
        return packets.ECSignPacket.decode(data);
      case packets.types.ECSIGNRESULT:
        return packets.ECSignResultPacket.decode(data);
      case packets.types.MINE:
        return packets.MinePacket.decode(data);
      case packets.types.MINERESULT:
        return packets.MineResultPacket.decode(data);
      case packets.types.SCRYPT:
        return packets.ScryptPacket.decode(data);
      case packets.types.SCRYPTRESULT:
        return packets.ScryptResultPacket.decode(data);
      default:
        throw new Error('Unknown packet.');
    }
  }
}

/**
 * Header
 * @ignore
 */

class Header {
  /**
   * Create a header.
   * @constructor
   */

  constructor(id, cmd, size) {
    this.id = id;
    this.cmd = cmd;
    this.size = size;
  }
}

/*
 * Expose
 */

module.exports = Parser;
