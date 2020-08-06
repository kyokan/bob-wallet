import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cn from 'classnames';
import moment from 'moment';

import * as names from '../../ducks/names';
import * as walletActions from '../../ducks/walletActions';
import {
  formatName,
  isAvailable,
  isBidding,
  isClosed,
  isComingSoon,
  isOpening,
  isReserved,
  isReveal,
} from '../../utils/nameHelpers';
import BidActionPanel from './BidActionPanel';
import Collapsible from '../../components/Collapsible';
import Blocktime from '../../components/Blocktime';
import AuctionGraph from '../../components/AuctionGraph';
import { showError, showSuccess } from '../../ducks/notifications';
import VickreyProcess from './VickreyProcess';
import BidHistory from './BidHistory';
import './domains.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';

const Sentry = require('@sentry/electron');

const analytics = aClientStub(() => require('electron').ipcRenderer);

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
    sendRenewal: tld => dispatch(names.sendRenewal(tld)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
    sendRedeem: tld => dispatch(names.sendRedeem(tld)),
    fetchPendingTransactions: () => dispatch(walletActions.fetchPendingTransactions()),
  }),
)
export default class Auction extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }),
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }),
    match: PropTypes.shape({
      params: PropTypes.shape({
        name: PropTypes.string.isRequired,
      }),
    }),
    getNameInfo: PropTypes.func.isRequired,
    sendRenewal: PropTypes.func.isRequired,
    sendRedeem: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    fetchPendingTransactions: PropTypes.func.isRequired,
    domain: PropTypes.object,
    chain: PropTypes.object,
  };

  async componentWillMount() {
    try {
      this.setState({isLoading: true});
      await this.props.getNameInfo(this.getDomain());
      await this.props.fetchPendingTransactions();
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
      this.props.showError('Something went wrong fetching this name. Please try again.');
    } finally {
      this.setState({isLoading: false});
    }
  }

  componentDidMount() {
    analytics.screenView('Auction');
  }

  getDomain = () => this.props.match.params.name;

  isOwned = () => {
    const {domain} = this.props;
    return domain && domain.isOwner;
  };

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
    const {domain} = this.props;

    if (isReserved(domain)) {
      return <BidActionPanel domain={domain} />;
    }

    if (this.isOwned()) {
      return <BidActionPanel domain={domain} />;
    }

    if (isClosed(domain)) {
      return <BidActionPanel domain={domain} />;
    }

    if (isOpening(domain) || isBidding(domain) || isReveal(domain)) {
      return <BidActionPanel domain={domain} />;
    }

    if (isAvailable(domain)) {
      return <BidActionPanel domain={domain} />;
    }

    return null;
  };

  renderContent() {
    const domainName = this.getDomain();

    return (
      <React.Fragment>
        <div className="domains__content">
          <div className="domains__content__title">{formatName(domainName)}</div>
          <div className="domains__content__info-wrapper">
            <div className="domains__content__info-panel">
              {this.renderAuctionDetails()}
            </div>
            {this.maybeRenderCollapsibles()}
          </div>
        </div>
      </React.Fragment>
    );
  }

  renderAuctionDetails() {
    if (this.state.isLoading || !this.props.domain) {
      return 'Loading...';
    }

    const domain = this.props.domain;
    const stats = domain.info && domain.info.stats || {};

    if (isOpening(domain) || isBidding(domain) || isReveal(domain)) {
      return <AuctionGraph />;
    }

    return (
      <div className={this.getContentClassName()}>
        {this.renderStatusInfo()}
        {this.maybeRenderDateBlock(() => isClosed(domain), 'Renew Starts', stats.renewalPeriodStart, stats.daysUntilExpire)}
        {this.maybeRenderDateBlock(() => isClosed(domain), 'Renew Close', stats.renewalPeriodEnd, stats.daysUntilExpire)}
      </div>
    );
  }

  maybeRenderCollapsibles() {
    const domain = this.props.domain || {};
    const bids = domain.bids || domain.reveals || [];
    const pillContent = bids.length === 1 ? `${bids.length} bid` : `${bids.length} bids`;

    if (isAvailable(domain) || isOpening(domain) || isBidding(domain) || isReveal(domain)) {
      return (
        <React.Fragment>
          <Collapsible className="domains__content__info-panel" title="Your Bids" pillContent={pillContent}>
            {this.props.domain ?
              <BidHistory
                bids={this.props.domain.bids}
                reveals={this.props.domain.reveals}
              /> :
              'Loading...'
            }
          </Collapsible>
          <Collapsible className="domains__content__info-panel" title="Vickrey Auction Process" defaultCollapsed>
            <VickreyProcess />
          </Collapsible>
        </React.Fragment>
      );
    } else {
      return <noscript />;
    }

  }

  getContentClassName() {
    const {domain} = this.props;
    const className = 'domains__content__info-panel__content';

    return cn(className, {
      [className + '--available']: isAvailable(domain),
      [className + '--reserved']: isReserved(domain),
      [className + '--closed']: isClosed(domain),
    });
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
      `Block #${height}`,
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
      // this.setState({ showCollapsibles: false })
    } else if (isOpening(domain)) {
      status = 'Opening';
      description = 'Bidding Soon';
    } else if (isBidding(domain)) {
      const bids = domain.bids || [];
      status = 'Available';
      description = `Bidding Now (${bids.length} bids)`;
    } else if (isComingSoon(domain, this.props.chain.height)) {
      status = 'Coming Soon';
      description = (
        <span>
          Available around <Blocktime height={domain.start.start} format="ll" />
        </span>
      );
    } else if (isAvailable(domain)) {
      status = 'Available';
      description = 'No Bids';
    } else if (isClosed(domain)) {
      status = 'Sold';
      // this.setState({ showCollapsibles: false })
    } else if (isReveal(domain)) {
      status = 'Revealing';
    } else {
      status = 'Unavailable';
    }

    return this.renderDetailBlock('Status', status, description);
  }
}
