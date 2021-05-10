import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import Submittable from "../Submittable";
import WizardHeader from "../WizardHeader";
import Checkbox from "../Checkbox";

@connect()
export default class StepPrivateKey extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onNext: PropTypes.func.isRequired,
    keyType: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      privKey: "",
      isKeyEncrypted: false,
      passphrase: "",
      pgpKeyId: "",
    };
  }

  onSubmit = () => {
    if (!this.canGoToNext()) return;

    this.props.onNext(
      this.state.privKey,
      this.state.passphrase,
      this.props.keyType === "PGP" ? this.state.pgpKeyId : null
    );
  };

  isValidPrivKey = () => {
    switch (this.props.keyType) {
      case "SSH":
        if (
          !/^-----BEGIN \w+ PRIVATE KEY-----[^]+-----END \w+ PRIVATE KEY-----$/.test(
            this.state.privKey.trim()
          )
        )
          return false;
        break;
      case "PGP":
        if (
          !/^-----BEGIN PGP PRIVATE KEY BLOCK-----[^]+-----END PGP PRIVATE KEY BLOCK-----$/.test(
            this.state.privKey.trim()
          )
        )
          return false;
        break;
      case "faucet":
        return true;
      default:
        return false;
    }
    return true;
  };

  canGoToNext() {
    if (!this.isValidPrivKey()) return false;
    if (this.state.isKeyEncrypted && this.state.passphrase.length === 0)
      return false;
    if (this.props.keyType === "PGP" && this.state.pgpKeyId.length === 0)
      return false;
    return true;
  }

  onChange = (name) => (e) => {
    this.setState({
      [name]: e.target.value,
    });
  };

  render() {
    const {
      currentStep,
      totalSteps,
      skipProofGeneration,
      keyType,
    } = this.props;

    const placeholder =
      keyType === "SSH"
        ? "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"
        : "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...\n-----BEGIN PGP PRIVATE KEY BLOCK-----";

    return (
      <div className="proof-modal">
        <WizardHeader currentStep={currentStep} totalSteps={totalSteps} />
        <div className="proof-modal__content">
          <Submittable onSubmit={this.onSubmit}>
            <div className="proof-modal__header_text">
              Paste your private key here
            </div>
            <div className="proof-modal__body-text">
              These are used offline and never leave your computer.
              <br />
              Or,{" "}
              <span
                className="proof-modal__body-text__link"
                onClick={skipProofGeneration}
              >
                generate proofs outside Bob.
              </span>
            </div>

            {/* Private Key */}
            <div className="step_privKey__privKey">
              <textarea
                placeholder={placeholder}
                value={this.state.privKey}
                onChange={this.onChange("privKey")}
                autoFocus
              ></textarea>
            </div>

            {/* PGP Key ID */}
            {keyType === "PGP" ? (
              <label className="step_privKey__pgp__label">
                <span>PGP Key ID</span>
                <div className="step_privKey__pgp__keyId">
                  <input
                    type="text"
                    placeholder="0xA8E101DF4C93E2BC"
                    value={this.state.pgpKeyId}
                    onChange={this.onChange("pgpKeyId")}
                  />
                </div>
              </label>
            ) : (
              ""
            )}

            {/* Is Private Key Encrypted */}
            <div className="terms__input">
              <span className="import_checkbox_container">
                <Checkbox
                  checked={this.state.isKeyEncrypted}
                  onChange={() =>
                    this.setState({
                      isKeyEncrypted: !this.state.isKeyEncrypted,
                    })
                  }
                />
              </span>
              <span className="import_checkbox_text">
                Is the key encrypted with a passphrase?
              </span>
            </div>

            {/* Passphrase */}
            {this.state.isKeyEncrypted ? (
              <div className="step_privKey__passphrase">
                <input
                  type="password"
                  placeholder="Enter passphrase"
                  value={this.state.passphrase}
                  onChange={this.onChange("passphrase")}
                />
              </div>
            ) : (
              ""
            )}
          </Submittable>
        </div>
        <div className="proof-modal__footer">
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={!this.canGoToNext()}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}
