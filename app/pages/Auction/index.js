import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cn from 'classnames';
import moment from 'moment';

import * as names from '../../ducks/names';
import { isAvailable, isBidding, isClosed, isOpening, isReserved, isReveal, } from '../../utils/name-helpers';
import { ReserveInfo, SoldInfo } from './info';
import BidActionPanel from './BidActionPanel';
import BidReminder from './BidReminder';
import Collapsible from '../../components/Collapsible';
import Blocktime from '../../components/Blocktime';
import './domains.scss';
import { showError } from '../../ducks/notifications';

@withRouter
@connect(
  (state, ownProps) => {
    const {name} = ownProps.match.params;
    return {
      domain: state.names[name],
      chain: state.node.chain,
    };
  },
  dispatch => ({
    getNameInfo: tld => dispatch(names.getNameInfo(tld)),
    showError: (message) => dispatch(showError(message))
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

  async componentWillMount() {
    try {
      this.setState({ isLoading: true });
      await this.props.getNameInfo(this.getDomain())
    } catch (e) {
      this.showError('Something went wrong fetching this name. Please try again.');
    } finally {
      this.setState({ isLoading: false });
    }
  }

  getDomain = () => this.props.match.params.name;

  render() {
    return (
      <div className="domains">
        {this.renderContent()}
        <div className="domains__action">
          {this.renderAuctionRight()}
        </div>
      </div>
    );
  }

  renderAuctionRight = () => {
    const {domain, chain} = this.props;

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

    if (isOpening(domain) || isBidding(domain) || isReveal(domain)) {
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
              {this.renderAuctionDetails()}
            </div>
          </div>
          <Collapsible className="domains__content__info-panel" title="Bid History" defaultCollapsed>
            hi
          </Collapsible>
          <Collapsible className="domains__content__info-panel" title="Vickrey Auction Process" defaultCollapsed>
            hi
          </Collapsible>
        </div>
      </React.Fragment>
    );
  }

  renderAuctionDetails() {
    if (this.state.isLoading || !this.props.domain) {
      return 'Loading...';
    }

    const stats = this.props.domain.info && this.props.domain.info.stats || {};

    return (
      <React.Fragment>
        {this.renderStatusInfo()}
        {this.maybeRenderDateBlock(() => isBidding(name), 'Bidding Open', stats.bidPeriodStart, stats.hoursUntilClose)}
        {this.maybeRenderDateBlock(() => isBidding(name), 'Bidding Close', stats.bidPeriodEnd, stats.hoursUntilClose)}
        {this.maybeRenderDateBlock(() => isReveal(name), 'Reveal Open', stats.revealPeriodStart, stats.hoursUntilClose)}
        {this.maybeRenderDateBlock(() => isReveal(name), 'Reveal Close', stats.revealPeriodEnd, stats.hoursUntilClose)}
      </React.Fragment>
    );
  }

  getContentClassName() {
    const {domain} = this.props;
    const className = 'domains__content__info-panel__content';

    return cn(className, {
      [className + '--available']: isAvailable(domain),
      [className + '--reserved']: isReserved(domain),
      [className + '--closed']: isClosed(domain),
    })
  }

  renderDetailBlock(title, content, description) {
    const className = 'domains__content__auction-detail';
    return (
      <div className={className}>
        <div className={`${className}__label`}>{title}:</div>
        <div className={`${className}__status`}>{content}</div>
        <div className={`${className}__description`}>{description}</div>
      </div>
    );
  }

  renderDateBlock(title, height, adjust) {
    return this.renderDetailBlock(
      title,
      <Blocktime
        height={height}
        adjust={d => moment(d).add(adjust, 'h')}
      />,
      `Block #${height}`
    );
  }

  maybeRenderDateBlock(condition, title, height, adjust) {
    if (!condition()) {
      return null;
    }

    return this.renderDateBlock(title, height, adjust);
  }

  renderStatusInfo() {
    const {domain} = this.props;
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

    return this.renderDetailBlock('Status', status, description);
  }
}
