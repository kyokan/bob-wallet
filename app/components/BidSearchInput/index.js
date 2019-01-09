import React from 'react';
import './bid-search-input.scss';

export default function BidSearchInput(props) {
  return (
    <div className={`bid-search-input ${props.className || ''}`}>
      <div className="bid-search-input__icon" />
      <input
        className="bid-search-input__input"
        placeholder={props.placeholder || "Search your bids"}
        onChange={props.onChange}
        value={props.value}
      />
    </div>
  );
}
