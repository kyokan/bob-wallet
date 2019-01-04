export const states = {
  OPENING: 'OPENING',
  BIDDING: 'BIDDING',
  REVEAL: 'REVEAL',
  CLOSED: 'CLOSED',
  REVOKED: 'REVOKED',
};

export const isAvailable = name => {
  const { start, info } = name || {};

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
  const { start } = name || {};

  // Not available if start is undefined
  if (!start) {
    return false;
  }

  return !!start.reserved;
};

export const isOpening = name => checkState(name, states.OPENING);
export const isBidding = name => checkState(name, states.BIDDING);
export const isReveal = name => checkState(name, states.REVEAL);
export const isRevoked = name => checkState(name, states.REVOKED);
export const isClosed = name => checkState(name, states.CLOSED);

function checkState(name, expectedState) {
  const { start, info } = name || {};

  // Not available if start is undefined
  if (!start || !info) {
    return false;
  }

  return info.state === expectedState;
}
