import React from 'react';
import Checkbox from '../../../components/Checkbox';

const ReviewBid = (props) => {
    const { bidAmount, disguiseAmount, hasAccepted, editBid, editDisguise, onChange, onClick, lockup } = props;
    

    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Review Your Bid</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Bid Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {`${bidAmount} HNS`}
            </div>
            <div className="domains__bid-now__action__edit-icon"
              onClick={editBid}
            />
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Disguise Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {disguiseAmount ? `${disguiseAmount} HNS` : ' - '}
            </div>
            <div className="domains__bid-now__action__edit-icon"
              onClick={editDisguise}
            />
          </div>
          <div className="domains__bid-now__divider" />
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Total Mask
            </div>
            <div className="domains__bid-now__info__value">
              {`${lockup} HNS`}
            </div>
            <div className="domains__bid-now__action__placeholder" />
          </div>
        </div>

        <div className="domains__bid-now__action">
          <div className="domains__bid-now__action__agreement">
            <Checkbox
              onChange={onChange}
              checked={hasAccepted}
            />
            <div className="domains__bid-now__action__agreement-text">
              I understand my bid cannot be changed after I submit it.
            </div>
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={onClick}
            disabled={!hasAccepted}
          >
            Submit Bid
          </button>
        </div>
      </div>
    );
}

export default ReviewBid;