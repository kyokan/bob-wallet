import React from 'react';
import ProgressBar from '../ProgressBar';
import './auction-graph.scss';

const AuctionGraph = props => {
  const { openProgress, biddingProgress, revealProgress } = props;
  return (
    <div className="auction-graph">
      <div className="auction-graph__column" style={{maxWidth: '10%'}}>
        <div className="auction-graph__column__headline">Open</div>
        <ProgressBar percentage={openProgress}/>
        <div className="auction-graph__column__text">01/30/19</div>
        <div className="auction-graph__column__text">#2480</div>
      </div>
      <div className="auction-graph__column" style={{maxWidth: '65%'}}>
        <div className="auction-graph__column__headline">Bidding Period</div>
        <ProgressBar percentage={biddingProgress}/>
        <div className="auction-graph__column__text__row">
          <div className="auction-graph__column__text__col">
            <div className="auction-graph__column__text">01/30/19</div>
            <div className="auction-graph__column__text">#2480</div>
          </div>
          <div className="auction-graph__column__text__col" style={{textAlign: 'right'}}>
            <div className="auction-graph__column__text">01/30/19</div>
            <div className="auction-graph__column__text">#2480</div>
          </div>
        </div>
      </div>
      <div className="auction-graph__column" style={{maxWidth: '25%'}}>
        <div className="auction-graph__column__headline">Reveal Period</div>
        <ProgressBar percentage={revealProgress}/>
        <div className="auction-graph__column__text__row">
          <div className="auction-graph__column__text__col">
            <div className="auction-graph__column__text">01/30/19</div>
            <div className="auction-graph__column__text">#2480</div>
          </div>
          <div className="auction-graph__column__text__col" style={{textAlign: 'right'}}>
            <div className="auction-graph__column__text">01/30/19</div>
            <div className="auction-graph__column__text">#2480</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuctionGraph;