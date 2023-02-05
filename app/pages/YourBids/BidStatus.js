import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import throttle from 'lodash.throttle';
import {
  isReveal,
  isClosed,
  isBidding,
  isOpening,
  isAvailable,
} from '../../utils/nameHelpers';
import Blocktime from '../../components/Blocktime';
import * as namesActions from "../../ducks/names";
import {I18nContext} from "../../utils/i18n";


class BidStatus extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
    height: PropTypes.number.isRequired,
    address: PropTypes.string.isRequired,
    fetchName: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  componentDidMount() {
    this.fetchName();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.height !== prevProps.height) {
      this.fetchName();
    }
  }

  fetchName = throttle(() => {
    if (this.props.name) {
      this.props.fetchName();
    }
  }, 10*1000, {leading: true, trailing: true}); // 10 seconds

  isSold = () => isClosed(this.props.domain);
  isReveal = () => isReveal(this.props.domain);
  isOwned = () => {
    const { domain } = this.props;
    return domain && domain.isOwner;
  };
  isBidding = () => isBidding(this.props.domain);
  isOpening = () => isOpening(this.props.domain);
  isAvailable = () => isAvailable(this.props.domain);

  getStatusClass() {
    let c = 'bid-status__dot';
    const { domain } = this.props;

    if (!domain) {
      return c;
    }

    if (this.isReveal()) {
      return `${c} ${c}--reveal`;
    }

    if (this.isOwned()) {
      return `${c} ${c}--owned`;
    }

    if (this.isSold()) {
      return `${c} ${c}--sold`;
    }

    if (this.isOpening()) {
      return `${c} ${c}--opening`;
    }

    if (this.isBidding()) {
      return `${c} ${c}--bidding`;
    }

    if (this.isAvailable()) {
      return `${c} ${c}--available`;
    }

    return `${c} ${c}--unavailable`;
  }

  render() {
    return (
      <div className="bid-status">
        <div className={this.getStatusClass()} />
        <div className="bid-status__text">
          {this.getStatusText()}
        </div>
      </div>
    )
  }

  getStatusText() {
    const { domain } = this.props;
    const {t} = this.context;

    if (!domain) {
      return t('loading');
    }

    if (this.isReveal()) {
      return t('revealingNow');
    }

    if (this.isOwned()) {
      return t('winningBid')
    }

    if (this.isSold()) {
      return t('sold');
    }

    if (this.isOpening()) {
      return t('openingNow');
    }

    if (this.isBidding()) {
      const { bids } = domain;
      const bidLength = bids.length || 0;
      const {t} = this.context;
      const bidText = `(${bidLength} ${t('bids')})`;

      return (
        <span>
          <span>{t('biddingNow')}</span>
          <span className="bid-status__text__paren">
            <span className="bid-status__text__link">{bidText}</span>
          </span>
        </span>
      );
    }

    if (this.isAvailable()) {
      return (
        <span>
          <span>{t('available')}</span>
          <span className="bid-status__text__paren">
            <Blocktime height={domain.start.start} />
          </span>
        </span>
      )
    }

    return t('unavailable');

  }
}

export default withRouter(
  connect(
    (state, ownProps) => {
      const name = state.names[ownProps.name];
      return {
        domain: name,
        height: state.node.chain.height,
        address: state.wallet.receiveAddress,
      };
    },
    (dispatch, ownProps) => ({
      fetchName: () => dispatch(namesActions.fetchName(ownProps.name, true)),
    }),
  )(BidStatus)
);
