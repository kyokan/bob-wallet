import React, { Component } from 'react';
import PropTypes from 'prop-types';
import MiniModal from '../../components/Modal/MiniModal.js';
import { connect } from 'react-redux';
import Dropdown from '../../components/Dropdown';
import Alert from "../../components/Alert";
import {launchExchangeAuction} from "../../ducks/exchange";
import {formatName} from "../../utils/nameHelpers";

export class GenerateListingModal extends Component {
  static propTypes = {
    listing: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);

    this.durationOpts = [1, 3, 5, 7, 14];

    this.state = {
      startPrice: Number(props.listing.params.startPrice) / 1e6,
      endPrice: Number(props.listing.params.endPrice) / 1e6,
      durationIdx: this.durationOpts.indexOf(props.listing.params.durationDays),
      errorMessage: '',
    };
  }

  generateProofs = async () => {
    try {
      const { launchExchangeAuction, listing } = this.props;
      const { startPrice, endPrice, durationIdx } = this.state;
      const durationDays = this.durationOpts[durationIdx];

      const overrideParams = { startPrice: startPrice * 1e6, endPrice: endPrice  * 1e6, durationDays };
      await launchExchangeAuction(listing.nameLock, overrideParams);
      this.props.onClose();
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
    }

  };

  render() {
    const {onClose, listing} = this.props;

    const isValid = String(this.state.startPrice).length &&
      String(this.state.endPrice).length &&
      Number(this.state.startPrice) > 0 &&
      Number(this.state.endPrice) > 0 &&
      Number(this.state.startPrice) > Number(this.state.endPrice);

    return (
      <MiniModal title="Create Listing" onClose={onClose}>
        <div className="exchange__place-listing-modal">
          <div className="exchange__label">Listing Name:</div>
          <div className="exchange__input">
            {formatName(listing.nameLock.name)}
          </div>

          <label className="exchange__label">Starting price:</label>
          <div className="exchange__input send__input">
            <input
              type="number"
              value={this.state.startPrice}
              onChange={(e) => this.setState({
                startPrice: e.target.value,
                errorMessage: '',
              })}
            />
          </div>

          <label className="exchange__label">Ending price:</label>
          <div className="exchange__input send__input">
            <input
              type="number"
              value={this.state.endPrice}
              onChange={(e) => this.setState({
                endPrice: e.target.value,
                errorMessage: '',
              })}
            />
          </div>

          <label className="exchange__label">Duration:</label>
          <Dropdown
            items={this.durationOpts.map(d => ({
              label: `${d} days`,
            }))}
            onChange={(i) => this.setState({
              durationIdx: i,
              errorMessage: '',
            })}
            currentIndex={this.state.durationIdx}
          />
          <Alert type="error" message={this.state.errorMessage} />
          <div className="place-bid-modal__buttons">
            <button
              className="place-bid-modal__cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="place-bid-modal__send"
              onClick={this.generateProofs}
              disabled={!isValid}
            >
              {'Generate Proofs'}
            </button>
          </div>
        </div>
      </MiniModal>
    );
  }
}

export default connect(
  (state) => ({

  }),
  (dispatch) => ({
    launchExchangeAuction: (nameLock, overrideParams) => dispatch(launchExchangeAuction(nameLock, overrideParams)),
  }),
)(GenerateListingModal);
