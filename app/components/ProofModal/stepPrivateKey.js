import fs from "fs";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import Submittable from "../Submittable";
import WizardHeader from "../WizardHeader";
import Checkbox from "../Checkbox";
const { dialog } = require("electron").remote;

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
      privKeyIsFile: false,
      isKeyEncrypted: false,
      passphrase: "",
      pgpKeyId: "",
    };
  }

  onSubmit = () => {
    if (!this.canGoToNext()) return;

    this.props.onNext(
      this.state.privKey,
      this.state.privKeyIsFile,
      this.state.passphrase,
      this.props.keyType === "PGP" ? this.state.pgpKeyId : null
    );
  };

  isValidPrivKey = (privKey = null) => {
    if (this.state.privKeyIsFile)
      return this.state.privKey && !!this.state.privKey.length;

    if (!privKey) privKey = this.state.privKey;
    privKey = privKey.trim();

    switch (this.props.keyType) {
      case "SSH":
        return /^-----BEGIN \w+ PRIVATE KEY-----[^]+-----END \w+ PRIVATE KEY-----$/.test(
          privKey
        );
      case "PGP":
        return /^-----BEGIN PGP PRIVATE KEY BLOCK-----[^]+-----END PGP PRIVATE KEY BLOCK-----$/.test(
          privKey
        );
      case "faucet":
        return true;
      default:
        return false;
    }
  };

  async onPrivKeyFileSelect(keyType) {
    const filters = {
      SSH: [
        {
          name: "All Files",
          extensions: ["*"],
        },
      ],
      PGP: [
        {
          name: "PGP Private Keys",
          extensions: ["asc", "gpg", "pgp"],
        },
        {
          name: "All Files",
          extensions: ["*"],
        },
      ],
    }[keyType];

    const {
      filePaths: [filepath],
    } = await dialog.showOpenDialog({
      title: "Open a private key file",
      properties: ["openFile"],
      filters: filters,
    });

    if (!filepath) return;

    this.setState({
      privKey: filepath,
    });
  }

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

    const {
      privKey,
      privKeyIsFile,
      pgpKeyId,
      isKeyEncrypted,
      passphrase,
    } = this.state;

    const placeholder =
      keyType === "SSH"
        ? "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"
        : "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...\n-----BEGIN PGP PRIVATE KEY BLOCK-----";

    return (
      <div className="proof-modal">
        <WizardHeader currentStep={currentStep} totalSteps={totalSteps} />
        <div className="proof-modal__content">
          <Submittable onSubmit={() => {}}>
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
              {privKeyIsFile ? (
                <div>
                  <button onClick={() => this.onPrivKeyFileSelect(keyType)}>
                    Open File
                  </button>
                  <span>{privKey}</span>
                </div>
              ) : (
                <textarea
                  placeholder={placeholder}
                  value={privKey}
                  onChange={this.onChange("privKey")}
                  autoFocus
                ></textarea>
              )}
            </div>

            {/* Switch between text and file inputs */}
            <p
              className="step_privKey__toggle_key_src"
              onClick={() =>
                this.setState({ privKeyIsFile: !privKeyIsFile, privKey: "" })
              }
            >
              {privKeyIsFile ? "Paste key" : "Select file"} instead...
            </p>

            {/* PGP Key ID */}
            {keyType === "PGP" ? (
              <label className="step_privKey__pgp__label">
                <span>PGP Key ID</span>
                <div className="step_privKey__pgp__keyId">
                  <input
                    type="text"
                    placeholder="0xA8E101DF4C93E2BC"
                    value={pgpKeyId}
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
                  checked={isKeyEncrypted}
                  onChange={() =>
                    this.setState({
                      isKeyEncrypted: !isKeyEncrypted,
                    })
                  }
                />
              </span>
              <span className="import_checkbox_text">
                Is the key encrypted with a passphrase?
              </span>
            </div>

            {/* Passphrase */}
            {isKeyEncrypted ? (
              <div className="step_privKey__passphrase">
                <input
                  type="password"
                  placeholder="Enter passphrase"
                  value={passphrase}
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
