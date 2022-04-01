import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';
import * as walletActions from '../../ducks/walletActions';
import Submittable from '../../components/Submittable';
import MiniModal from '../../components/Modal/MiniModal';
import { MTX } from 'hsd/lib/primitives';
import walletClient from '../../utils/walletClient';

@connect(
  (state) => ({
    confirmMultisig: state.wallet.confirmMultisig,
    network: state.wallet.network,
    wid: state.wallet.wid,
  }),
  dispatch => ({
    unlockWallet: (name, passphrase) => dispatch(walletActions.unlockWallet(name, passphrase)),
    signMessage: (message) => dispatch(walletActions.signMessage(message)),
    closeConfirmMultisig: () => dispatch(walletActions.closeConfirmMultisig()),
  })
)
export default class ConfirmMultisigModal extends Component {
  static propTypes = {
    wid: PropTypes.string.isRequired,
    unlockWallet: PropTypes.func.isRequired,
    signMessage: PropTypes.func.isRequired,
    closeConfirmMultisig: PropTypes.func.isRequired,
    confirmMultisig: PropTypes.object.isRequired,
  };

  static defaultProps = {
    className: ''
  };

  state = {
    passphrase: '',
    showError: false,
    outputs: null,
  };

  componentDidUpdate(prevProps) {
    if(prevProps.confirmMultisig.tx != this.props.confirmMultisig.tx) {
        if(this.props.confirmMultisig.tx) {
            Promise.all(this.props.confirmMultisig.tx.outputs.map(async (output) => {
                const hasAddress = await walletClient.hasAddress(output.address.toString(this.props.network));
                return hasAddress ? null : output;
            })).then(outputs => {
                this.setState({outputs: outputs.filter(o => o != null)});
            });
        }
    }
  }

  async handleSign(passphrase) {
    try {
      const {wid, unlockWallet, confirmMultisig, closeConfirmMultisig, signMessage} = this.props;
      await unlockWallet(wid, passphrase);
      
      const resp = await walletClient.signMessage(confirmMultisig.tx.toJSON(), passphrase);
      confirmMultisig.resolve(resp);
      closeConfirmMultisig();
      this.setState({passphrase: '', outputs: null});
    } catch (error) {
      alert('Failed to sign: ' + error?.message);
    }
  }

  onClose = () => {
    this.setState({passphrase:'', showError: false, outputs: null});
    this.props.confirmMultisig.reject({message: 'No Password'});
    this.props.closeConfirmMultisig();
  };

  render() {
    const { passphrase, showError } = this.state;

    if (!this.props.confirmMultisig.get || !this.state.outputs)
      return null;

    return (
      <MiniModal
        onClose={this.onClose}
        title="Enter Password"
        centered
      >
        <Submittable onSubmit={() => this.handleSign(passphrase)}>
          <div>
            <input
              className={c('login_password_input', {
                'login_password_input--error': showError
              })}
              type="password"
              placeholder="Your password"
              onChange={e =>
                this.setState({ passphrase: e.target.value, showError: false })
              }
              value={passphrase}
              autoFocus
            />
          </div>
          <div className="login_password_error">
            {showError && `Invalid password.`}
          </div>
        </Submittable>
        <div style={{marginTop: '10px', marginBottom: '10px', wordWrap: 'break-word'}}>
            This transaction will send the following:
            <br/><br/>
            {this.state.outputs.map((output,idx) => (
                <p key={idx}>
                    <strong>{(output.value/1000000).toFixed(4)} HNS</strong> to 
                    <strong> {output.address.toString(this.props.network)}</strong>
                </p>
            ))}
            <br/>
            <div>Are you sure you want to sign?</div>
        </div>
        <button
          className="extension_cta_button login_cta"
          onClick={() => this.handleSign(passphrase)}
        >
          Sign
        </button>
      </MiniModal>
    );
  }
}
