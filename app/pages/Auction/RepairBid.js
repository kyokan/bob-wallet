import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {consensus} from 'hsd/lib/protocol';
import walletClient from '../../utils/walletClient';
import * as names from '../../ducks/names';
import { showError } from '../../ducks/notifications';
import {parseFloatValue} from "../../utils/balances";

@connect(
  () => ({}),
  dispatch => ({
    getNameInfo: tld => dispatch(names.getNameInfo(tld)),
    showError: (message) => dispatch(showError(message)),
  }),
)
export default class RepairBid extends Component {
  static propTypes = {
    bid: PropTypes.object.isRequired,
    getNameInfo: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
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

  processValue = async (val) => {
    const value = parseFloatValue(val);

    if (value) {
      this.setState({value: value});
      return this.verifyBid(parsed);
    }
  };

  async verifyBid(value) {
    const {bid} = this.props;
    try {
      const attempt = await walletClient.getNonce({
        name: bid.name,
        address: bid.from,
        bid: value * consensus.COIN
      });

      if (attempt.blind === bid.blind) {
        this.setState({isCorrect: true});

        await walletClient.importNonce({
          name: bid.name,
          address: bid.from,
          bid: value,
        });

        this.props.getNameInfo(bid.name);
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  }

  render() {
    return this.state.isEditing
    ? this.renderInput()
    : this.renderRepairableBid();
  }
}
