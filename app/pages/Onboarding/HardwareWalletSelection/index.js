import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import WizardHeader from "../../../components/WizardHeader";
import "./index.scss";

@connect()
export default class HardwareWalletSelection extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
  };

  state = {
    isLedgerWallet: false,
  };

  render() {
    const { currentStep, totalSteps, onBack, onNext, onCancel } = this.props;

    return (
      <div className="hw-selection">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        <div className="hw-selection__content">
          <div className="hw-selection__header_text">
            Do you want to use a hardware wallet?
          </div>
          <div className="hw-selection__body-text">
            With a hardware wallet, your private keys never leave the device.
            Otherwise, the keys will be encrypted and stored on this computer.
          </div>
          <div className="hw-selection__select-container">
            <button
              type="button"
              className="funding-options__footer__secondary-btn"
              onClick={() => onNext(true)}
            >
              Use a Ledger Device
            </button>
            <button
              type="button"
              className="funding-options__footer__secondary-btn"
              onClick={() => onNext(false)}
            >
              Store wallet on computer
            </button>
          </div>
        </div>
      </div>
    );
  }
}
