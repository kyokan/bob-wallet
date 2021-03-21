import React, { Component } from 'react';
import PropTypes from "prop-types";
import { MiniModal } from '../../components/Modal/MiniModal';
import { connect } from 'react-redux';
import {showError, showSuccess} from '../../ducks/notifications';
import { waitForPassphrase, hasAddress } from '../../ducks/walletActions';
import isValidAddress from "../../utils/verifyAddress";
import Alert from "../../components/Alert";
import {transferMany} from "../../ducks/names";

@connect(
  (state) => ({
    network: state.node.network,
    names: state.myDomains.names,
  }),
  (dispatch) => ({
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
    waitForPassphrase: () => dispatch(waitForPassphrase()),
    hasAddress: (address) => dispatch(hasAddress(address)),
    transferMany: (names, address) => dispatch(transferMany(names, address)),
  }),
)
export default class BulkTransfer extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    names: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedOptions: [],
      recipientAddress: '',
      errorMessage: '',
    };
  }

  updateToAddress = e => {
    this.setState({
      recipientAddress: e.target.value,
      errorMessage: '',
    });
    if (e.target.value.length > 2 && !isValidAddress(e.target.value, this.props.network)) {
      this.setState({
        errorMessage: 'Invalid Address Prefix',
      });
    }
  };

  onTransfer = async () => {
    const { selectedOptions, recipientAddress } = this.state;
    try {
      await this.props.transferMany(selectedOptions, recipientAddress);
      this.props.showSuccess(`Your transfer request is submitted! Please wait around 15 minutes for it to be confirmed.`);
      this.props.onClose();
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
    }
  };

  render() {
    const {names} = this.props;
    return (
      <MiniModal
        title="Bulk Transfer"
        onClose={this.props.onClose}
      >
        <div className="bulk-transfer">
          <Alert type="error" message={this.state.errorMessage} />
          <p>
            Select the domains you wish to transfer
          </p>
          <div className="bulk-transfer">
            <div className="bulk-transfer__label">Transferring to</div>
            <div className="bulk-transfer__input">
              <input
                type="text"
                placeholder="Recipient address"
                onChange={this.updateToAddress}
                value={this.state.recipientAddress}
              />
            </div>
          </div>
          <select
            onChange={e => {
              this.setState({
                selectedOptions: Array.prototype.map.call(e.target.selectedOptions, option => option.value),
              });
            }}
            value={this.state.selectedOptions}
            size={10}
            multiple
          >
            {Object.keys(names).map(name => {
              const domain = names[name];

              if (!domain.registered || domain.transfer !== 0) return null;

              return (
                <option
                  key={domain.name}
                  value={domain.name}
                >
                  {domain.name}
                </option>
              )
            })}
          </select>
          <div className="bulk-transfer__actions">
            <button
              disabled={!this.state.selectedOptions.length || !this.state.recipientAddress}
              onClick={this.onTransfer}
            >
              Start Transfer
            </button>
          </div>
        </div>
      </MiniModal>
    );
  }
}
