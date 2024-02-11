import React, { Component } from 'react';
import PropTypes from "prop-types";
import { consensus } from 'hsd/lib/protocol';
import { MiniModal } from '../../components/Modal/MiniModal';
import { Table, HeaderRow, HeaderItem, TableRow, TableItem } from '../../components/Table';
import { connect } from 'react-redux';
import {showError, showSuccess} from '../../ducks/notifications';
import { waitForPassphrase, hasAddress } from '../../ducks/walletActions';
import isValidAddress from "../../utils/verifyAddress";
import Alert from "../../components/Alert";
import {transferMany} from "../../ducks/names";
import {I18nContext} from "../../utils/i18n";

const MAX_TRANSFERS_PER_BATCH = consensus.MAX_BLOCK_UPDATES / 6;

@connect(
  (state) => ({
    network: state.wallet.network,
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
    transferNames: PropTypes.arrayOf(PropTypes.string),
    onClose: PropTypes.func.isRequired,
    names: PropTypes.object.isRequired,
  };

  static defaultProps = {
    transferNames: [],
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
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
        errorMessage: this.context.t('invalidAddress'),
      });
    }
  };

  onTransfer = async () => {
    const { transferNames } = this.props;
    const { recipientAddress } = this.state;
    try {
      const res = await this.props.transferMany(transferNames, recipientAddress);
      if (res !== null) {
        this.props.showSuccess(this.context.t('bulkTransferSuccess'));
      }
      this.props.onClose();
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
    }
  };

  renderErrors() {
    const {names, transferNames} = this.props;
    const {errorMessage} = this.state;
    const {t} = this.context;

    const errors = [];

    if (errorMessage) {
      errors.push(errorMessage);
    }

    // Max limit per batch
    if (transferNames.length > MAX_TRANSFERS_PER_BATCH) {
      errors.push(t('bulkTransferErrorMaxLimit', MAX_TRANSFERS_PER_BATCH));
    }

    // Unregistered names cannot be transferred
    const unregistered = transferNames.filter(name => !names[name].registered);
    if (unregistered.length) {
      errors.push(
        t('bulkTransferErrorNotRegistered', unregistered.length)
        + ': '
        + unregistered.join(', ')
      );
    }

    // Names already in transfer cannot start another transfer
    const transferring = transferNames.filter(name => names[name].transfer !== 0);
    if (transferring.length) {
      errors.push(
        t('bulkTransferErrorInTransfer', transferring.length)
        + ': '
        + transferring.join(', ')
      );
    }

    if (errors.length === 0) {
      return null;
    }

    return errors.map(error => (
      <Alert type="error">{error}</Alert>
    ));
  }

  render() {
    const {transferNames, onClose} = this.props;
    const {recipientAddress} = this.state;
    const { t } = this.context;

    const errors = this.renderErrors();

    const canTransfer = (
      recipientAddress
      && transferNames.length
      && !errors
    );

    return (
      <MiniModal
        title={t('bulkTransfer')}
        onClose={onClose}
        className="bulk-transfer"
        overflow
      >
        {/* Errors */}
        {errors}

        <p>{t('bulkTransferLabel', transferNames.length)}</p>

        {/* To */}
        <div>
          <div className="bulk-transfer__label">{t('transferringTo')}</div>
          <div className="bulk-transfer__input">
            <input
              type="text"
              placeholder={t('recipientAddress')}
              onChange={this.updateToAddress}
              value={recipientAddress}
            />
          </div>
        </div>

        {/* Names */}
        <Table className="bulk-transfer__table">
          <HeaderRow>
            <HeaderItem>{t('domainsPlural')}</HeaderItem>
          </HeaderRow>

          <div className="bulk-transfer__table__body">
            {transferNames.map((name, idx) => (
              <TableRow key={idx}>
                <TableItem>{name}/</TableItem>
              </TableRow>
            ))}
          </div>
        </Table>

        {/* Transfer */}
        <div className="bulk-transfer__actions">
          <button
            disabled={!canTransfer}
            onClick={this.onTransfer}
          >
            {t(`startTransfer`)}
          </button>
        </div>
      </MiniModal>
    );
  }
}
