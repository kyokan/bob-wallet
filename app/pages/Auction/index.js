import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cn from 'classnames';
import moment from 'moment';

import * as names from '../../ducks/names';
import {
  isAvailable,
  isReserved,
  isClosed,
  isBidding,
  isOpening,
  isReveal,
} from '../../utils/name-helpers';
import { CloseInfo, SoldInfo, ReserveInfo } from './info';
import BidActionPanel from './BidActionPanel';
import BidReminder from './BidReminder';
import Collapsible from '../../components/Collapsible';
import Blocktime from '../../components/Blocktime';
import './domains.scss';

@withRouter
@connect(
  (state, ownProps) => {
    const { name } = ownProps.match.params;
    return {
      domain: state.names[name],
      chain: state.node.chain,
    };
  },
  dispatch => ({
    getNameInfo: tld => dispatch(names.getNameInfo(tld)),
  }),
)
export default class Auction extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }),
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }),
    match: PropTypes.shape({
      params: PropTypes.shape({
        name: PropTypes.string.isRequired
      })
    }),
    getNameInfo: PropTypes.func.isRequired,
    domain: PropTypes.object,
    chain: PropTypes.object,
  };

  componentWillMount() {
    this.props.getNameInfo(this.getDomain())
      .catch(e => console.error(e.message));
  }

  getDomain = () => this.props.match.params.name;

  render() {
    return (
      <div className="domains">
        { this.renderContent() }
        <div className="domains__action">
          {this.renderAuctionRight()}
        </div>
      </div>
    );
  }

  renderAuctionRight = () => {
    const { domain, chain } = this.props;

    if (isReserved(domain)) {
      return <ReserveInfo />;
    }

    if (isClosed(domain)) {
      return (
        <SoldInfo
          owner={domain.info.owner.hash}
          paidValue={domain.info.value}
        />
      );
    }

    if (isOpening(domain) || isBidding(domain)) {
      return <BidActionPanel domain={domain} />;
    }

    if (isAvailable(domain)) {
      if (chain && chain.height >= domain.start.start) {
        return <BidActionPanel domain={domain} />;
      }
      return <BidReminder domain={domain} />;
    }

    return null;
  };

  renderContent() {
    const domain = this.getDomain();

    return (
      <React.Fragment>
        <div className="domains__content">
          <div className="domains__content__title">{`${domain}/`}</div>
          <div className="domains__content__info-panel">
            <div className="domains__content__info-panel__title">Auction Details</div>
            <div className={this.getContentClassName()}>
              { this.renderStatusInfo() }
              { this.renderStart() }
              { this.renderEnd() }
            </div>
          </div>
          <Collapsible  className="domains__content__info-panel" title="Bid History" defaultCollapsed>
            hi
          </Collapsible>
          <Collapsible  className="domains__content__info-panel" title="Vickrey Auction Process" defaultCollapsed>
            hi
          </Collapsible>
        </div>
      </React.Fragment>
    );
  }

  getContentClassName() {
    const { domain } = this.props;
    const className = 'domains__content__info-panel__content';

    return cn(className, {
      [className + '--available']: isAvailable(domain),
      [className + '--reserved']: isReserved(domain),
      [className + '--closed']: isClosed(domain),
    })
  }

  renderStatusInfo() {
    const { domain } = this.props;
    const className = 'domains__content__auction-detail';

    let status = '';
    let description = '';
    if (isReserved(domain)) {
      status = 'Reserved';
    } else if (isOpening(domain)) {
      status = 'Available';
      description = 'Opening Bid';
    } else if (isBidding(name)) {
      status = 'Available';
      description = 'Bidding Now';
    } else if (isAvailable(domain)) {
      status = 'Available';
      description = 'No Bids';
    } else if (isClosed(domain)) {
      status = 'Closed';
    } else if (isReveal(domain)) {
      status = 'Revealing';
    } else {
      status = 'Unavailable';
    }

    return (
      <div className={className}>
        <div className={`${className}__label`}>Status:</div>
        <div className={`${className}__status`}>{status}</div>
        <div className={`${className}__description`}>{description}</div>
      </div>
    );
  }

  renderStart() {
    const { domain } = this.props;
    const className = 'domains__content__auction-detail';

    let label = '';
    let status = '';
    let block = '';

    if (isReserved(domain)) {
      return null;
    } else if (isOpening(domain)) {
      label = 'Bidding Open:';
      status = <Blocktime height={domain.info.stats.openPeriodStart} />;
      block = domain.info.stats.openPeriodStart;
    } else if (isBidding(name)) {
      label = 'Bidding Start:';
      status = <Blocktime height={domain.info.stats.bidPeriodStart} />;
      block = domain.info.stats.bidPeriodStart;
    } else if (isAvailable(domain)) {
      label = 'Bidding Open:';
      status = <Blocktime height={0} adjust={d => moment(d).add(domain.start.week, 'w')} />;
      block = domain.start.start;
    } else if (isClosed(domain)) {
      label = 'Renewal Start:';
      status = <Blocktime height={domain.info.stats.renewalPeriodStart} />;
      block = domain.info.stats.renewalPeriodStart;
    } else if (isReveal(domain)) {
      label = 'Reveal Start:';
      status = <Blocktime height={domain.info.stats.revealPeriodStart} />;
      block = domain.info.stats.revealPeriodStart;
    } else {
      return null;
    }

    return (
      <div className={className}>
        <div className={`${className}__label`}>{label}</div>
        <div className={`${className}__status`}>{status}</div>
        <div className={`${className}__description`}>{`Block # ${block}`}</div>
      </div>
    );
  }

  renderEnd() {
    const { domain } = this.props;
    const className = 'domains__content__auction-detail';

    let label = '';
    let status = '';
    let block = '';

    if (isReserved(domain)) {
      return null;
    } else if (isOpening(domain)) {
      label = 'Bidding Start:';
      status = (
        <Blocktime
          height={domain.info.stats.openPeriodStart}
          adjust={d => moment(d).add(domain.info.stats.hoursUntilBidding, 'h')}
        />
      );
      block = domain.info.stats.openPeriodEnd;
    } else if (isBidding(name)) {
      label = 'Reveal Start:';
      status = (
        <Blocktime
          height={domain.info.stats.bidPeriodStart}
          adjust={d => moment(d).add(domain.info.stats.hoursUntilReveal, 'h')}
        />
      );
      block = domain.info.stats.bidPeriodEnd;
    } else if (isAvailable(domain)) {
      return null;
    } else if (isClosed(domain)) {
      label = 'Expired:';
      status = (
        <Blocktime
          height={domain.info.stats.renewalPeriodStart}
          adjust={d => moment(d).add(domain.info.stats.daysUntilExpire, 'd')}
        />
      );
      block = domain.info.stats.renewalPeriodEnd;
    } else if (isReveal(domain)) {
      label = 'Bidding Close:';
      status = (
        <Blocktime
          height={domain.info.stats.revealPeriodStart}
          adjust={d => moment(d).add(domain.info.stats.hoursUntilClose, 'h')}
        />
      );
      block = domain.info.stats.revealPeriodEnd;
    } else {
      return null;
    }

    return (
      <div className={className}>
        <div className={`${className}__label`}>{label}</div>
        <div className={`${className}__status`}>{status}</div>
        <div className={`${className}__description`}>{`Block # ${block}`}</div>
      </div>
    );
  }
}
