import React from 'react';

export default function Hash({ value }) {
  return (
    <React.Fragment>
      {value.slice(0, 10)}...{value.slice(-10)}
    </React.Fragment>
  );
}