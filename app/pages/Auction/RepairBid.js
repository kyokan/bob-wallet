import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {consensus} from 'hsd/lib/protocol';
import walletClient from '../../utils/walletClient';


class RepairBid extends Component {
  static propTypes = {
    bid: PropTypes.object.isRequired,
    getNameInfo: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      isEditing: false,
      value: "",
      isCorrect: false,
    };
  }

  renderRepairableBid() {
    return (
      <div
        className="bid-history__repair-bid"
        onClick={() => this.setState({isEditing: true})}
      >
        {"⚠️ Unknown Bid"}
      </div>
    );
  }

  renderInput() {
    return (
      <input
        className={this.state.isCorrect ? 'bid-history__correct' : ''}
        placeholder="0.000000"
        value={this.state.value}
        onChange={(e) => {
            this.processValue(e.target.value);
          }
        }
        disabled={this.state.isCorrect}
      />      
    );
  }

  processValue(val) {
    const value = val.match(/[0-9]*\.?[0-9]{0,6}/g)[0];
    if (value * consensus.COIN > consensus.MAX_MONEY)
      return;
    this.setState({value: value});
    this.verifyBid(value);
  }

  verifyBid(value) {
    const {bid} = this.props;
    walletClient.getNonce({
      name: bid.name,
      address: bid.from,
      bid: value * consensus.COIN
    }).then((attempt) => {
      if (attempt.blind === bid.blind)
        this.setState({isCorrect: true});
        walletClient.importNonce({
          name: bid.name,
          address: bid.from,
          bid: parseFloat(value),
        }).then(() => {
          this.props.getNameInfo(bid.name);
        });
    });

    
  }

  render() {
    return this.state.isEditing
    ? this.renderInput()
    : this.renderRepairableBid();
  }
}

export default RepairBid;
