import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import c from 'classnames';
import { isAvailable, isBidding, isClosed, isOpening, isReserved, isReveal } from '../../../utils/nameHelpers';
import * as watchingActions from '../../../ducks/watching';
import OpenBid from './OpenBid';
import BidNow from './BidNow';
import Reveal from './Reveal';
import Owned from './Owned';
import '../domains.scss';
import Sold from './Sold';
import Reserved from './Reserved';
import { clientStub as aClientStub } from '../../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

class BidActionPanel extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    watchList: PropTypes.array.isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        name: PropTypes.string.isRequired,
      }),
    }),
    network: PropTypes.string.isRequired,
    watchDomain: PropTypes.func.isRequired,
    unwatchDomain: PropTypes.func.isRequired,
  };

  state = {
    isLoading: false,
    event: {},
  };

  isOwned = () => {
    const {domain} = this.props;
    return domain && domain.isOwner;
  };

  render() {
    const {match, network} = this.props;
    const {params: {name}} = match;
    const isWatching = this.props.watchList.includes(this.props.match.params.name);

    return (
      <React.Fragment>
        {this.renderActionPanel()}
        <div className="domains__watch">
          <div
            className={c('domains__watch__heart-icon', {
              'domains__watch__heart-icon--active': isWatching,
            })}
            onClick={() => {
              if (isWatching) {
                this.props.unwatchDomain(name, network);
                analytics.track('unwatched domain', {
                  source: 'Bid Action Panel',
                });
              } else {
                this.props.watchDomain(name, network);
                analytics.track('watched domain', {
                  source: 'Bid Action Panel',
                });
              }
            }} />
          <div className="domains__watch__text">
            {isWatching ? 'Added to Watchlist' : 'Add to Watchlist'}
          </div>
        </div>
      </React.Fragment>
    );
  }

  renderActionPanel() {
    const {domain} = this.props;
    const name = this.props.match.params.name;

    if (isReserved(domain)) {
      return <Reserved domain={domain} name={name} />;
    }

    if (this.isOwned()) {
      return (
        <Owned
          domain={domain}
          name={name}
        />
      );
    }

    if (isClosed(domain)) {
      return <Sold domain={domain} name={name} />;
    }

    if (isBidding(domain)) {
      return (
        <BidNow
          domain={domain}
          name={name}
        />
      );
    }

    if (isReveal(domain)) {
      return (
        <Reveal
          domain={domain}
          name={name}
        />
      );
    }

    if (isAvailable(domain) || isOpening(domain)) {
      return (
        <OpenBid
          domain={domain}
          name={name}
        />
      );
    }

    return <noscript />;
  }
}

export default withRouter(
  connect(
    (state) => ({
      watchList: state.watching.names,
      currentBlock: state.node.chain.height,
      network: state.node.network,
    }),
    dispatch => ({
      watchDomain: (name, network) => dispatch(watchingActions.addName(name, network)),
      unwatchDomain: (name, network) => dispatch(watchingActions.removeName(name, network)),
    }),
  )(BidActionPanel),
);
