import React from 'react';

const Reveal = (props) => {
  const { ownReveal, children } = props;
  return (
    <div className="domains__bid-now">
      <div className="domains__bid-now__title">{ownReveal ? 'Bid revealed.' : 'Revealing'}</div>
      <div className="domains__bid-now__content">
       {children}
      </div>
    </div>
  );
}

export default Reveal;