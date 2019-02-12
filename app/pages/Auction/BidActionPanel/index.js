import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import c from 'classnames';
import { protocol } from 'hsd';
import { isAvailable, isBidding, isClosed, isOpening, isReveal } from '../../../utils/name-helpers';
import * as watchingActions from '../../../ducks/watching';
import OpenBid from './OpenBid';
import BidNow from './BidNow';
import Reveal from './Reveal';
import '../domains.scss';
import '../add-to-calendar.scss';

@connect(
  (state) => ({
    network: state.node.network,
  })
)
class BidActionPanel extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    watchList: PropTypes.array.isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        name: PropTypes.string.isRequired
      })
    }),
  };

  state = {
    isLoading: false,
    isWatching: false,
    event: {},
  };

  async componentWillMount() {
    await this.props.getWatching(this.props.network);
    const isWatching = this.props.watchList.includes(this.props.match.params.name)
    this.setState({ isWatching: isWatching || {} })
  }

  render() {
    const name = this.props.match.params.name;
    const network = this.props.network;
    const isWatching = this.state.isWatching;
    return (
      <React.Fragment>
        {this.renderActionPanel()}
        <div className="domains__watch">
          <div className={c("domains__watch__heart-icon", {
            "domains__watch__heart-icon--active": this.state.isWatching
            })} onClick={() => {
              isWatching ? this.props.unwatchDomain(name, network) : this.props.watchDomain(name, network);
              this.setState({ isWatching: !isWatching })
            }}/>
          <div className="domains__watch__text">{this.state.isWatching ? 'Added to Watchlist' : 'Add to Watchlist'}</div>
        </div>
      </React.Fragment>
    )
  }

  renderActionPanel() {
    const { domain } = this.props;
    const name = this.props.match.params.name;

    if (isBidding(domain)) {
      return (
        <BidNow
          domain={domain}
          name={name}
         />
        )
    }

    if (isReveal(domain)) {
      return (
        <Reveal
          domain={domain}
          name={name}
        />
      )
    }

    if (isAvailable(domain) || isOpening(domain)) {
      return (
        <OpenBid
          domain={domain}
          name={name}
        />
      )
    }

    return <noscript />;
  }
}

export default withRouter(
  connect(
    (state) => ({
      confirmedBalance: state.wallet.balance.confirmed,
      watchList: state.watching.names,
      currentBlock: state.node.chain.height,
      network: state.node.network,
    }),
    dispatch => ({
      getWatching: (network) => dispatch(watchingActions.getWatching(network)),
      watchDomain: (name, network) => dispatch(watchingActions.addName(name, network)),
      unwatchDomain: (name, network) => dispatch(watchingActions.removeName(name, network)),
    }),
  )(BidActionPanel)
);
