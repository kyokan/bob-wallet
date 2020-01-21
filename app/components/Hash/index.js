import React from 'react';

export default function Hash({ value, start, end }) {
  return (
    <React.Fragment>
      {value.slice(0, start || 10)}...{value.slice(end || -10)}
    </React.Fragment>
  );
}
