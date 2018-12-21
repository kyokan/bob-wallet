import React from 'react';
import PropTypes from 'prop-types';

function bidding({ date = '', block, type }) {
  let dateText = '';

  if (date instanceof Date) {
    dateText = date.toDateString();
  } else if (typeof date === 'string') {
    dateText = date;
  }

  let blockText = '';

  if (isNaN(block)) {
    blockText = block;
  } else {
    blockText = `#${block}`;
  }

  return (
    <div className="auction__group">
      <div className="auction__title">
        {`Bidding ${type}`}
      </div>
      <div className="auction__large">
        { dateText }
      </div>
      <div className="auction__block">
        { `Block ${blockText}` }
      </div>
    </div>
  );
}

bidding.propTypes = {
  type: PropTypes.string,
  date: PropTypes.instanceOf(Date),
  block: PropTypes.number,
};

export function BiddingOpen({
  date,
  block,
}) {
  return bidding({
    date,
    block,
    type: 'open',
  });
}

BiddingOpen.propTypes = {
  date: PropTypes.instanceOf(Date),
  block: PropTypes.number,
};

export function BiddingClose({
  date,
  block,
}) {
  return bidding({
    date,
    block,
    type: 'close',
  });
}

BiddingClose.propTypes = {
  date: PropTypes.instanceOf(Date),
  block: PropTypes.number,
};
