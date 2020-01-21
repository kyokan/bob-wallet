import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import c from 'classnames';
import ProgressBar from '../ProgressBar';
import Blocktime from '../Blocktime';
import { isBidding, isOpening, isReveal, } from '../../utils/nameHelpers';
import './auction-graph.scss';

const OPENING = 0;
const ISBIDDING = 1;
const REVEALING = 2;

@withRouter
@connect(
  (state, ownProps) => {
    const {name} = ownProps.match.params;
    return {
      domain: state.names[name],
      chain: state.node.chain,
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
    currentStep: 0,
    openProgress: 0,
    biddingProgress: 0,
    revealProgress: 0,
  }

  async componentDidMount() {
    await this.getStatusInfo(this.props.domain);
  }

  getStatusInfo(domain) {
    const stats = domain.info && domain.info.stats || {};

    if (isOpening(domain)) {
      this.setState({ 
        currentStep: OPENING, 
        openProgress: (1 - (stats.openPeriodEnd - this.props.chain.height) / (stats.openPeriodEnd - stats.openPeriodStart)) * 100,
      }); 
    } else if (isBidding(domain)) {
      this.setState({ 
        currentStep: ISBIDDING, 
        openProgress: 100,
        biddingProgress: (1 - (stats.bidPeriodEnd - this.props.chain.height) / (stats.bidPeriodEnd - stats.bidPeriodStart)) * 100,
      }); 
    } else if (isReveal(domain)) {
      this.setState({ 
        currentStep: REVEALING,
        openProgress: 100,  
        biddingProgress: 100,
        revealProgress: (1 - (stats.revealPeriodEnd - this.props.chain.height) / (stats.revealPeriodEnd - stats.revealPeriodStart)) * 100,
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

  maybeRenderDateBlock(condition, height, adjust, alignRight) {
    if (!condition()) {
      return (
        null
      )
    }

    return this.renderDateBlock(height, adjust, alignRight);
  }

  renderPlaceholder(isDone, alignRight) {
    return (
      <div className={c("auction-graph__column__text__col", {
        "auction-graph__column__text__col--right": alignRight,
      })} >
        <div className="auction-graph__column__text">
          {isDone ? '' : 'TBA'}
        </div>
      </div>
    )
  }

  render() {
    const domain = this.props.domain;
    const stats = domain.info && domain.info.stats || {};
    const { openProgress, biddingProgress, revealProgress, currentStep } = this.state;
    const chain = this.props.chain || {};
    const currentBlock = chain.height;
    
    if (!this.props.domain) {
      return null;
    }
  
    return (
      <div className="auction-graph">
        <div className="auction-graph__current-block">Current Block: #{currentBlock}</div>
        <div className="auction-graph__column" style={{maxWidth: '15%'}}>
          <div className="auction-graph__column__headline">Open</div>
          <ProgressBar percentage={openProgress} />
          { this.maybeRenderDateBlock(() => isOpening(domain), stats.openPeriodStart, stats.hoursUntilBidding) || this.renderPlaceholder(OPENING < currentStep)}
        </div>
        <div className="auction-graph__column" style={{maxWidth: '30%'}}>
          <div className="auction-graph__column__headline">Bidding Period</div>
          <ProgressBar percentage={biddingProgress} />
            { this.maybeRenderDateBlock(() => isOpening(domain), stats.openPeriodEnd, stats.hoursUntilBidding) || this.maybeRenderDateBlock(() => isBidding(domain), stats.bidPeriodStart, stats.hoursUntilReveal)|| this.renderPlaceholder(ISBIDDING < currentStep)}
        </div>
        <div className="auction-graph__column" style={{maxWidth: '55%'}}>
          <div className="auction-graph__column__headline">Reveal Period</div>
          <ProgressBar percentage={revealProgress}/>
          <div className="auction-graph__column__text__row">
            { this.maybeRenderDateBlock(() => isBidding(domain), stats.bidPeriodEnd, stats.hoursUntilReveal) || this.maybeRenderDateBlock(() => isReveal(domain), stats.revealPeriodStart, stats.hoursUntilClose) || this.renderPlaceholder(REVEALING < currentStep)}
            { this.maybeRenderDateBlock(() => isReveal(domain), stats.revealPeriodEnd, stats.hoursUntilClose, true) || this.renderPlaceholder(REVEALING < currentStep, true)}
          </div>
        </div>
      </div>
    )
  }
}
