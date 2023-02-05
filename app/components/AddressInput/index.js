import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import isValidAddress from '../../utils/verifyAddress';
import { I18nContext } from '../../utils/i18n';
import { debounce } from '../../utils/throttle';
import hip2 from "../../utils/hip2Client";
import Alert from '../Alert';
import LockSVG from '../../assets/images/lock.svg';
import RingsSVG from '../../assets/images/rings.svg';
import './address-input.scss';


@connect(
  state => ({
    isSynchronized: state.node.isRunning && (state.node.chain || {}).progress >= 0.999,
    noDns: state.node.noDns,
    hip2Port: state.hip2.port,
    network: state.wallet.network,
  })
)
class AddressInput extends Component {
  static propTypes = {
    isSynchronized: PropTypes.bool.isRequired,
    noDns: PropTypes.bool.isRequired,
    hip2Port: PropTypes.number.isRequired,
    network: PropTypes.string.isRequired,
    onAddress: PropTypes.func,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      input: '',
      address: '',
      loading: false,
      errorMessage: '',
    };

    hip2.setServers([`127.0.0.1:${props.hip2Port}`]);
  }

  handleEscape = (event) => {
    if (this.state.input && event.key === 'Escape') {
      this.resetInput();
    }
  }

  componentDidMount = () => {
    document.addEventListener('keydown', this.handleEscape);
    this.props.onAddress?.({
      domain: '',
      address: ''
    });
  }

  componentWillUnmount = () => {
    document.removeEventListener('keydown', this.handleEscape);
  }

  _resolveHip2Address = async (input) => {
    const {t} = this.context;
    const {network, onAddress} = this.props;

    try {
      const addr = await hip2.fetchAddress(input);

      // prevent latency attacks
      const currentInput = this.state.input.slice(1);
      if (input !== currentInput) return;

      const isValid = addr.length < 3 || isValidAddress(addr, network);
      this.setState({
        loading: false,
        address: addr,
        errorMessage: !isValid ? t('invalidAddress') : '',
      });
      onAddress?.({domain: currentInput, address: isValid ? addr : ''});
    } catch (error) {
      // prevent latency attacks
      const currentInput = this.state.input.slice(1);
      if (input !== currentInput) return;

      const {code} = error;
      const errorText = {
        EINVALID: t('hip2InvalidAddress'),
        ELARGE: t('hip2InvalidAddress'),
        ECOLLISION: t('hip2InvalidAlias'),
        EINSECURE: t('hip2InvalidTLSA'),
      }[code] || t('hip2AddressNotFound');

      this.setState({loading: false, errorMessage: errorText});
      onAddress?.({domain: '', address: ''});
    }
  }
  resolveHip2Address = debounce(this._resolveHip2Address, 125);

  onInputChange = (input) => {
    const {t} = this.context;
    const {isSynchronized, noDns, network, onAddress} = this.props;

    const oldInput = this.state.input;
    const oldIsHip2Input = oldInput.startsWith('@');

    // HIP-2 -> HIP-2:
    if (oldIsHip2Input) {
      input = '@' + input;
    }

    const isHip2Input = input.startsWith('@');
    const trimmedInput = isHip2Input ? input.slice(1) : input;

    // regular -> HIP-2:
    if (!oldIsHip2Input && isHip2Input) {
      this.setState({input: input});
    }

    // Clear field if empty
    if (!trimmedInput) {
      this.setState({
        input: input,
        address: '',
        loading: false,
        errorMessage: '',
      });
      onAddress?.({domain: '', address: ''});
      return;
    }

    // resolve regular
    if (!isHip2Input) {
      const isValid = isValidAddress(input, network);
      this.setState({
        input: input,
        address: input,
        loading: false,
        errorMessage: !(input.length < 3 || isValid) ? t('invalidAddress') : '',
      });
      onAddress?.({domain: '', address: isValid ? input : ''});
      return;
    }

    // Do not resolve HIP-2 if
    // we are still syncing or DNS isn't enabled
    const isHip2Disabled = noDns || !isSynchronized;
    if (isHip2Disabled) {
      this.setState({
        input: input,
        address: '',
        loading: false,
        errorMessage: '',
      });
      onAddress?.({domain: '', address: ''});
      return;
    };

    // resolve HIP-2
    this.setState({
      input: input,
      address: '',
      loading: true,
      errorMessage: '',
    });
    onAddress?.({domain: '', address: ''});
    this.resolveHip2Address(trimmedInput);
  }

  resetInput = () => {
    const {onAddress} = this.props;
    const {input} = this.state;
    if (input === '@') {
      this.setState({input: '', address: '', loading: false, errorMessage: ''});
      onAddress?.({domain: '', address: ''});
    }
  }

  render() {
    const {t} = this.context;
    const {noDns, isSynchronized} = this.props;
    const {input, address, loading, errorMessage} = this.state;

    const isHip2Input = input.startsWith('@');
    const trimmedInput = isHip2Input ? input.slice(1) : input;

    let placeholder = t('recipientAddressHip2Enabled');

    if (isHip2Input) {
      placeholder = t('recipientHip2Address');
    }
    if (!isSynchronized) {
      placeholder = t('recipientAddressHip2Syncing');
    }
    if (noDns) {
      placeholder = t('recipientAddress');
    }

    return (
      <div className="addr-input">
        <div className="addr-input__input">
          {/* HIP-2: Loading/Lock icon */}
          {isHip2Input &&
            <span className="addr-input__prefix">
              {address ?
                <img src={LockSVG} />
                : loading ?
                  <img src={RingsSVG} />
                  : '@'
              }
            </span>
          }

          {/* Input field */}
          <input
            type="text"
            value={trimmedInput}
            onChange={(e) => this.onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Backspace' && this.resetInput()}
            placeholder={placeholder}
            spellCheck="false"
          />
        </div>

        {/* Error */}
        <Alert type="error" message={errorMessage} />

        {/* HIP-2: address */}
        {isHip2Input &&
          <Alert type="info" message={address && `↪ ${address}`} />
        }
      </div>
    );
  }
}

export default AddressInput;