import React from 'react';

export default function Hash({ value, start, end }) {
  const hash = value || '';
  return (
    <React.Fragment>
      {hash.slice(0, start || 10)}...{hash.slice(end || -10)}
    </React.Fragment>
  );
}
