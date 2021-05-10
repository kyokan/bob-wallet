import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import Submittable from "../Submittable";
import WizardHeader from "../WizardHeader";

@connect()
export default class StepProofs extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    claims: PropTypes.object.isRequired,
    isUploading: PropTypes.bool.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {};
  }

  onSubmit = () => {
    this.props.onNext();
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
            <div className="proof-modal__header_text">Broadcast Proofs</div>
            <div className="proof-modal__body-text">
              This is an encoded proof that needs to be broadcast. Once done,
              the transaction should show up in 15-20 minutes.
            </div>

            {/* Proofs */}
            {this.props.claims.airdropProofs.map((proof, idx) => (
              <div className="step_proofs__proof" key={idx}>
                {proof.b64encoded}
              </div>
            ))}
          </Submittable>
        </div>
        <div className="proof-modal__footer">
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={this.props.isUploading}
          >
            {this.props.isUploading ? "Uploading..." : "Broadcast Proof"}
          </button>
        </div>
      </div>
    );
  }
}
