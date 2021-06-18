import punycode from 'punycode';

export const states = {
  OPENING: 'OPENING',
  BIDDING: 'BIDDING',
  REVEAL: 'REVEAL',
  CLOSED: 'CLOSED',
  REVOKED: 'REVOKED',
};

const STATES_TO_OPS = {
  OPENING: 'OPEN',
  BIDDING: 'BID',
  REVEAL: 'REVEAL',
};

export const isComingSoon = (name, currentHeight) => {
  return name && name.start && name.start.start > currentHeight;
};

export const isAvailable = name => {
  const {start, info} = name || {};

  if (!start) {
    return false;
  }

  if (start.reserved) {
    return false;
  }

  if (!info) {
    return true;
  }

  if (isBidding(name) || isOpening(name)) {
    return true;
  }

  return false;
};

export const isReserved = name => {
  const {start} = name || {};
  const {info} = name || {};

  // Maybe already claimed
  if (isClosed(name))
    return false;

  // Not available if start is undefined
  if (!start) {
    return false;
  }

  // Reserved names become un-reserved after they are expired or revoked.
  if (info) {
    return !!start.reserved && !info.expired;
  }

  return !!start.reserved;
};

export const isOpening = name => checkState(name, states.OPENING);
export const isBidding = name => checkState(name, states.BIDDING);
export const isReveal = name => checkState(name, states.REVEAL);
export const isRevoked = name => checkState(name, states.REVOKED);
export const isClosed = name => checkState(name, states.CLOSED);

function checkState(name, expectedState) {
  if (!name) {
    return false;
  }

  const {start, info} = name;
  const ops = STATES_TO_OPS[expectedState];

  if (typeof ops !== 'undefined' && name.pendingOperation === ops) {
    return true;
  }

  // Not available if start is undefined
  if (!start || !info) {
    return false;
  }

  // This check is needed for #278:
  // When the current height is 1 less than bidPeriodEnd,
  // no new bids can be added as the last bid block is already being mined.
  if (info.stats.blocksUntilReveal === 1) {
    if (expectedState == 'BIDDING') return false;
    if (expectedState == 'REVEAL') return true;
  }
  return info.state === expectedState;
}


export const decodePunycode = name => {
  try {
    return punycode.toASCII(name);
  } catch(e) {}

  return name;
}

export const formatName = name => {
  if (!name)
    return name;

  try {
    const unicode = punycode.toUnicode(name);
    if (unicode !== name) {
      return `${name}/ (${unicode})`;
    }
  } catch(e) {}

  return `${name}/`;
}
