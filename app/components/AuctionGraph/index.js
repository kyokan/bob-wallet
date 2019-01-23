import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import c from 'classnames';
import { protocol } from 'hsd';
import ProgressBar from '../ProgressBar';
import Blocktime from '../Blocktime';
import { isBidding, isOpening, isReveal, } from '../../utils/name-helpers';
import './auction-graph.scss';

@withRouter
@connect(
  (state, ownProps) => {
    const {name} = ownProps.match.params;
    return {
      domain: state.names[name],
      chain: state.node.chain,
      network: state.node.network,
    };
  })
export default class AuctionGraph extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
  }

  static defaultProps = {
    domain: {},
  }

  state = {
    progress: {
      open: 0,
      bidding: 0,
      reveal: 0,
    },
    settings: {
      auctionStart: 0,
      biddingPeriod: 0,
      revealPeriod: 0,
    },
    openPeriodStart: 0,
    openPeriodEnd: 0,
    bidPeriodEnd: 0,
    revealPeriodEnd: 0,
  }

  async componentDidMount() {
    // get network settings to calculate blocktimes
    const network = protocol && protocol.networks && protocol.networks[this.props.network];
    await this.setState({
      settings: { 
        auctionStart: 5,
        biddingPeriod: network.names.biddingPeriod,
        revealPeriod: network.names.revealPeriod,
      },
    })
    await this.getStatusInfo(this.props.domain);
  }

  getStatusInfo(domain) {
    const stats = domain.info && domain.info.stats || {};
    const { auctionStart, biddingPeriod, revealPeriod } = this.state.settings;

    if (isOpening(domain)) {
      const openPeriodStart = stats.openPeriodStart;
      const openPeriodEnd = stats.openPeriodEnd;
      const bidPeriodEnd = stats.openPeriodEnd + biddingPeriod;
      const revealPeriodEnd = bidPeriodEnd + revealPeriod;

      this.setState({ 
        progress: {
          open: (1 - (stats.openPeriodEnd - this.props.chain.height) / (stats.openPeriodEnd - stats.openPeriodStart)) * 100,
          bidding: 0,
          reveal: 0,
        },
        openPeriodStart,
        openPeriodEnd,
        bidPeriodEnd,
        revealPeriodEnd,
      }); 
    } else if (isBidding(domain)) {
      const openPeriodStart = stats.bidPeriodStart - auctionStart;
      const openPeriodEnd = stats.bidPeriodStart;
      const bidPeriodEnd = stats.bidPeriodEnd;
      const revealPeriodEnd = stats.bidPeriodEnd + revealPeriod;

      this.setState({ 
        progress: {
          open: 100,
          bidding: (1 - (stats.bidPeriodEnd - this.props.chain.height) / (stats.bidPeriodEnd - stats.bidPeriodStart)) * 100,
          reveal: 0,
        },
        openPeriodStart,
        openPeriodEnd,
        bidPeriodEnd,
        revealPeriodEnd,
      }); 
    } else if (isReveal(domain)) {
      const openPeriodStart = stats.revealPeriodStart - biddingPeriod - auctionStart;
      const openPeriodEnd = stats.revealPeriodStart - biddingPeriod;
      const bidPeriodEnd = stats.revealPeriodStart;
      const revealPeriodEnd = stats.revealPeriodEnd;
      this.setState({ 
        progress: {
          open: 100,
          bidding: 100,
          reveal: (1 - (stats.revealPeriodEnd - this.props.chain.height) / (stats.revealPeriodEnd - stats.revealPeriodStart)) * 100,
        },
        openPeriodStart,
        openPeriodEnd,
        bidPeriodEnd,
        revealPeriodEnd,
      });
    } 
    return;
  }

  renderDetailBlock(date, block, alignRight) {
    return (
      <div className={c("auction-graph__column__text__col", {
        "auction-graph__column__text__col--right": alignRight,
      })} >
        <div className="auction-graph__column__text">{date}</div>
        <div className="auction-graph__column__text">{block}</div>
      </div>
    );
  }

  renderDateBlock(height, adjust, alignRight) {
    if (!height) {
      return null;
    }

    return this.renderDetailBlock(
      <Blocktime
        height={height}
        adjust={d => moment(d).add(adjust, 'h')}
      />,
      `#${height}`, 
      alignRight
    );
  }

  maybeRenderDateBlock(height, adjust, alignRight) {
    return this.renderDateBlock(height, adjust, alignRight);
  }

  renderPlaceholder(isDone, alignRight) {
    return (
      <div className={c("auction-graph__column__text__col", {
        "auction-graph__column__text__col--right": alignRight,
      })} >
        <div className="auction-graph__column__text">
          {isDone ? 'Done' : 'TBA'}
        </div>
      </div>
    )
  }

  render() {
    const domain = this.props.domain;
    const stats = domain.info && domain.info.stats || {};
    const { open, bidding, reveal } = this.state.progress;
    const chain = this.props.chain || {};
    const currentBlock = chain.height;
    const { openPeriodStart, openPeriodEnd, bidPeriodEnd, revealPeriodEnd } = this.state;
    
    if (!this.props.domain) {
      return null;
    }

    return (
      <div className="auction-graph">
        <div className="auction-graph__current-block">Current Block: #{currentBlock}</div>
        <div className="auction-graph__column" style={{maxWidth: '10%'}}>
          <div className="auction-graph__column__headline">Open</div>
          <ProgressBar percentage={open} />
          { this.maybeRenderDateBlock(openPeriodStart) }
        </div>
        <div className="auction-graph__column" style={{maxWidth: '30%'}}>
          <div className="auction-graph__column__headline">Bidding Period</div>
          <ProgressBar percentage={bidding} />
            { this.maybeRenderDateBlock(openPeriodEnd) }
        </div>
        <div className="auction-graph__column" style={{maxWidth: '60%'}}>
          <div className="auction-graph__column__headline">Reveal Period</div>
          <ProgressBar percentage={reveal}/>
          <div className="auction-graph__column__text__row">
            { this.maybeRenderDateBlock(bidPeriodEnd) }
            { this.maybeRenderDateBlock(revealPeriodEnd, true) }
          </div>
        </div>
      </div>
    )
  }
}