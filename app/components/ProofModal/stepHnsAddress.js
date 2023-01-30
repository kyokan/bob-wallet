import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import Submittable from "../Submittable";
import WizardHeader from "../WizardHeader";
import isValidAddress from "../../utils/verifyAddress";

@connect((state) => ({
  address: state.wallet.receiveAddress,
  network: state.wallet.network,
}))
export default class StepHnsAddress extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onNext: PropTypes.func.isRequired,
    address: PropTypes.string.isRequired,
    network: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      hnsAddr: props.address,
    };
  }

  onSubmit = () => {
    if (!isValidAddress(this.state.hnsAddr, this.props.network)) return;

    this.props.onNext(this.state.hnsAddr);
  };

  onChange = (name) => (e) => {
    this.setState({
      [name]: e.target.value,
    });
  };

  render() {
    const { currentStep, totalSteps, onBack } = this.props;

    return (
      <div className="proof-modal">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
        />
        <div className="proof-modal__content">
          <Submittable onSubmit={this.onSubmit}>
            <div className="proof-modal__header_text">
              Recieving HNS Address
            </div>
            <div className="proof-modal__body-text">
              A receive address is generated for this wallet and used below.
            </div>

            {/* HNS Address */}
            <div className="proof-modal__input">
              <input
                type="text"
                placeholder="Enter HNS Address"
                value={this.state.hnsAddr}
                onChange={this.onChange("hnsAddr")}
                disabled
              />
            </div>
          </Submittable>
        </div>
        <div className="proof-modal__footer">
          <button
            className="proof-modal__footer__secondary-cta"
            onClick={this.props.onBack}
          >
            Back
          </button>
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={this.state.hnsAddr.length === 0}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}
