import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { shell } from 'electron';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cn from 'classnames';
import moment from 'moment';
import throttle from 'lodash.throttle';

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
import Records from '../../components/Records';
import './domains.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';
import NameClaimModal from "../../components/NameClaimModal";
import {I18nContext} from "../../utils/i18n";

const Sentry = (
  process.type === 'renderer'
  ? require('@sentry/electron/renderer')
  : require('@sentry/electron/main')
);

const analytics = aClientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  (state, ownProps) => {
    const {name} = ownProps.match.params;
    return {
      domain: state.names[name],
      chain: state.node.chain,
      explorer: state.node.explorer,
    };
  },
  dispatch => ({
    getNameInfo: tld => dispatch(names.getNameInfo(tld)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
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
    showSuccess: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    fetchPendingTransactions: PropTypes.func.isRequired,
    domain: PropTypes.object,
    chain: PropTypes.object,
    explorer: PropTypes.object.isRequired,
  };

  state = {
    isShowingClaimModal: false,
  };

  static contextType = I18nContext;

  async componentDidMount() {
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
    analytics.screenView('Auction');
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.chain.height !== prevProps.chain.height) {
      this.refreshInfo();
    }
  }

  refreshInfo = throttle(() => {
    this.props.getNameInfo(this.getDomain());
    this.props.fetchPendingTransactions();
  }, 10*1000, {leading: true, trailing: true}) // 10 seconds

  getDomain = () => this.props.match.params.name;

  isOwned = () => {
    const {domain} = this.props;
    return domain && domain.isOwner;
  };

  render() {
    return (
      <div className="domains">
        { this.state.isShowingClaimModal && (
          <NameClaimModal
            name={this.props.domain.name}
            onClose={() => this.setState({ isShowingClaimModal: false })}
          />
        )}
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

    const viewOnExplorer = () => {
      shell.openExternal(this.props.explorer.name.replace('%s', this.props.domain.name))
    }

    return (
      <React.Fragment>
        <div className="domains__content">
          <div className="domains__content__title">
            {formatName(domainName)}
            <div
              className="domains__content__title__explorer-open-icon"
              onClick={viewOnExplorer} />
          </div>
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
    const {t} = this.context;
    const domain = this.props.domain || {};
    const {bids, reveals, pendingOperation, pendingOperationMeta} = domain;

    const bidsIncludingPending =
      (pendingOperation === 'BID') ?
        [...pendingOperationMeta.bids, ...bids]
        : bids;

    const bidsOrReveals = domain.bids || domain.reveals || [];
    const pillContent = bidsOrReveals.length === 1 ? `${bidsOrReveals.length} bid` : `${bidsOrReveals.length} bids`;

    if (isAvailable(domain) || isOpening(domain) || isBidding(domain) || isReveal(domain) || isClosed(domain)) {
      return (
        <React.Fragment>

          <Collapsible className="domains__content__info-panel" title="Bids" pillContent={pillContent}>
            {
              this.props.domain ?
                <BidHistory bids={bidsIncludingPending} reveals={reveals} />
                : t('loading')
            }
          </Collapsible>

          {!isClosed(domain) ?
            <Collapsible className="domains__content__info-panel" title="Vickrey Auction Process" defaultCollapsed>
              <VickreyProcess />
            </Collapsible> : null
          }

          {!isAvailable(domain) && domain.info ?
            <Collapsible className="domains__content__info-panel" title="Records">
              <Records
                name={domain.name}
                transferring={!!domain.info && domain.info.transfer !== 0}
              />
            </Collapsible> : null
          }

        </React.Fragment>
      );
    } else {
      return null;
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
    const {t} = this.context;
    let status = '';
    let description = '';

    if (isReserved(domain)) {
      status = t('reserved');
      description = (
        <button
          onClick={() => this.setState({ isShowingClaimModal: true })}
        >
          {t('reservedCTAText')}
        </button>
      );
    } else if (isOpening(domain)) {
      status = t('opening');
      description = t('biddingSoon');
    } else if (isBidding(domain)) {
      const bids = domain.bids || [];
      status = t('available');
      description = `${t('biddingNow')} (${bids.length} ${t('bids')})`;
    } else if (isComingSoon(domain, this.props.chain.height)) {
      status = t('comingSoon');
      description = (
        <span>
          {t('available')} <Blocktime height={domain.start.start} format="ll" />
        </span>
      );
    } else if (isAvailable(domain)) {
      status = t('available');
      description = t('noBids');
    } else if (isClosed(domain)) {
      status = t('sold');
      // this.setState({ showCollapsibles: false })
    } else if (isReveal(domain)) {
      status = t('revealing');
    } else {
      status = t('unavailable');
    }

    return this.renderDetailBlock(t('status'), status, description);
  }
}
