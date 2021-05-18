import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import Submittable from "../Submittable";
import WizardHeader from "../WizardHeader";
import ProgressBar from "../ProgressBar";

@connect()
export default class StepGenerating extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    claims: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      progress: 50,
      log: [], // array of strings, one for each line in log
      isGenerating: false,
    };
  }

  componentDidUpdate(prevProps, prevState) {
    // Update log lines as status changes
    if (
      prevProps.claims.airdropStatus.status !=
      this.props.claims.airdropStatus.status
    ) {
      this.setState({
        log: [...this.state.log, this.props.claims.airdropStatus.status],
      });

      // Scroll to end as new log lines are added
      const maxScrollTop =
        this.logContainer.scrollHeight - this.logContainer.clientHeight;
      this.logContainer.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
    }
  }

  onSubmit = () => {
    this.props.onNext();
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
            <div className="proof-modal__header_text">Creating Proofs</div>
            <div className="proof-modal__body-text">
              Sit back and relax, this will take a few minutes.
            </div>

            <ProgressBar percentage={this.props.claims.airdropStatus.percent} />

            {/* Log */}
            <div
              className="step_generating__log"
              ref={(el) => {
                this.logContainer = el;
              }}
            >
              {this.state.log.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
              <p></p>
            </div>
          </Submittable>
        </div>
        <div className="proof-modal__footer">
          <button
            className="proof-modal__footer__secondary-cta"
            onClick={this.props.onBack}
            disabled={this.props.claims.airdropIsGenerating}
          >
            Start Over
          </button>
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={
              this.props.claims.airdropIsGenerating ||
              !(
                this.props.claims.airdropProofs &&
                this.props.claims.airdropProofs.length > 0
              )
            }
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}
