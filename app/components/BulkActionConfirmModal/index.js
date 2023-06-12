import React, { Component } from 'react';
import PropTypes from 'prop-types';
import throttle from 'lodash.throttle';
import { connect } from 'react-redux';
import { consensus } from 'hsd/lib/protocol';
import Alert from '../../components/Alert';
import Blocktime from '../../components/Blocktime';
import Checkbox from '../../components/Checkbox';
import { MiniModal } from '../../components/Modal/MiniModal';
import { Table, HeaderRow, HeaderItem, TableRow, TableItem } from '../../components/Table';
import { sendBatch } from "../../ducks/names";
import { showSuccess } from '../../ducks/notifications';
import walletClient from "../../utils/walletClient";
import { I18nContext } from '../../utils/i18n';
import './bulk-action-confirm-modal.scss';
import { LISTING_STATUS } from '../../constants/exchange';

const TITLES = {
  register: 'Register',
  finalize: 'Finalize',
  renew: 'Renew',
  transferring: 'Transferring',
};

const MAX_LIMITS = {
  register: consensus.MAX_BLOCK_RENEWALS / 6,
  finalize: consensus.MAX_BLOCK_RENEWALS / 6,
  renew: consensus.MAX_BLOCK_RENEWALS / 6,
}
// TODO: remove - v
// const MAX_LIMITS = {
//   register: 1,
//   finalize: 1,
//   renew: 1,
// }

@connect(
  (state) => ({
    walletHeight: state.wallet.walletHeight,
    finalizableExchangeListings: state.exchange.listings.filter(
      l => l.status === LISTING_STATUS.TRANSFER_CONFIRMED
    ).map(l => l.nameLock.name),
  }),
  (dispatch) => ({
    showSuccess: (message) => dispatch(showSuccess(message)),
    sendBatch: (actions) => dispatch(sendBatch(actions)),
  }),
)
export default class BulkTransfer extends Component {
  static propTypes = {
    action: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onRefresh: PropTypes.func,

    walletHeight: PropTypes.number.isRequired,
    finalizableExchangeListings: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      selectableNames: [],
      selectedNames: [],
      errorMessage: '',
    };
  }

  componentDidMount() {
    this.getSelectableNames(true);
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.props.action !== prevProps.action
      || this.props.walletHeight !== prevProps.walletHeight
    ) {
      this.refreshSelectableNames();
    }
  }

  refreshSelectableNames = throttle(
    () => this.getSelectableNames(),
    10 * 1000,
    { leading: true, trailing: true }
  );

  /**
   * Get a list of actionable names
   * @param {boolean} setSelected whether to update selected names list
   */
  getSelectableNames = async (setSelected = false) => {
    const { action } = this.props;

    try {
      const names = await walletClient.getNamesForBulkAction(action);
      this.setState({
        selectableNames: names,
        errorMessage: '',
      });
      if (setSelected) {
        this.setState({
          selectedNames: names.slice(0, MAX_LIMITS[action]).map(name => name.name),
        })
      }
    } catch (error) {
      this.setState({
        selectableNames: [],
        errorMessage: error.message,
      });
    }
  }

  /**
   * Mark a name as (un)selected
   * @param {string} name name to update selection for
   * @param {boolean} isSelected new select state
   */
  updateNameSelect(name, isSelected) {
    this.setState(state => {
      const withoutName = state.selectedNames.filter(x => x !== name);

      if (isSelected) {
        return { selectedNames: [...withoutName, name] }
      } else {
        return { selectedNames: withoutName }
      }
    });
  }

  doAction = async () => {
    const { action, onRefresh } = this.props;
    const { selectedNames } = this.state;

    try {
      this.setState({ errorMessage: '' });

      let payload;
      switch (action) {
        case 'register':
          payload = selectedNames.map(name => [
            'UPDATE',
            name,
            { records: [] },
          ])
          break;

        case 'finalize':
          payload = selectedNames.map(name => [
            'FINALIZE',
            name,
          ])
          break;

        case 'renew':
          payload = selectedNames.map(name => [
            'RENEW',
            name,
          ])
          break;

        default:
          throw new Error('Invalid action.');
      }

      const res = await this.props.sendBatch(payload);

      if (res !== null) {
        this.props.showSuccess(this.context.t('genericRequestSuccess'));
        if (onRefresh) onRefresh();
      }
      this.props.onClose();
    } catch (error) {
      this.setState({ errorMessage: error.message });
    }
  }

  render() {
    const { action, onClose } = this.props;
    const { selectedNames } = this.state;
    const { t } = this.context;

    // Invalid action doesn't render modal
    if (!Object.keys(TITLES).includes(action)) return null;

    const errors = this.renderErrors();
    const canDoAction = selectedNames.length && !errors;

    return (
      <MiniModal
        title={TITLES[action]}
        onClose={onClose}
        className="bulk-action"
        overflow
      >
        {/* Errors */}
        {errors}

        {/* <p>{t(LABELS[action])}</p> */}

        {/* Names list */}
        {this.renderNames()}

        {/* Do action */}
        <div className="bulk-action__actions">
          {action !== 'transferring' ?
            <button
              disabled={!canDoAction}
              onClick={this.doAction}
            >
              {action} {selectedNames.length} domain(s)
            </button>
            : null
          }
        </div>
      </MiniModal>
    );
  }

  renderErrors() {
    const { action, finalizableExchangeListings } = this.props;
    const { selectedNames, errorMessage } = this.state;

    const errors = [];

    // Errors thrown when doing action
    if (errorMessage) {
      errors.push(errorMessage);
    }

    // Max limit per batch
    const maxLimit = MAX_LIMITS[action];
    if (selectedNames.length > maxLimit) {
      errors.push(`Only ${maxLimit} domains can be selected at once.`);
    }

    // Shakedex needs to generate presigns so
    // don't allow finalizing with regular transfers
    const selectedExchangeNames = selectedNames.filter(
      name => finalizableExchangeListings.includes(name)
    );
    if (selectedExchangeNames.length) {
      errors.push(`${selectedExchangeNames.length} domain(s) must be finalized in Exchange: ${selectedExchangeNames.join(', ')}`);
    }

    // TODO: don't allow finalizing atomic swap finalizes
    // We first need mark transfers with intent and then check here

    if (errors.length === 0) {
      return null;
    }

    return errors.map((error, idx) => (
      <Alert type="error" key={idx}>{error}</Alert>
    ));
  }

  renderNames() {
    const { action } = this.props;
    const { selectableNames } = this.state;
    const { t } = this.context;

    return (
      <Table className="bulk-action__table">
        <HeaderRow>
          <HeaderItem className="table__header__item--checkbox"></HeaderItem>
          <HeaderItem className="table__header__item--domain">Domains</HeaderItem>
          {action === 'renew' ?
            <HeaderItem className="table__header__item--time">Expires in</HeaderItem>
            : null
          }
          {action === 'transferring' ?
            <HeaderItem className="table__header__item--time">Finalize in</HeaderItem>
            : null
          }
        </HeaderRow>

        <div className="bulk-action__table__body">
          {selectableNames.map((name, idx) => this.renderNameRow(name, idx))}
        </div>
      </Table>
    );
  }

  renderNameRow(name, idx) {
    const { action, walletHeight } = this.props;
    const { selectedNames } = this.state;
    const { t } = this.context;

    return (
      <TableRow key={idx}>

        {/* Checkbox */}
        <TableItem className="table__row__item--checkbox">
          <Checkbox
            checked={selectedNames.includes(name.name)}
            onChange={(e) => this.updateNameSelect(name.name, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </TableItem>

        {/* Name */}
        <TableItem className="table__row__item--domain">{name.name}/</TableItem>

        {/* Renew within */}
        {action === 'renew' ?
          <TableItem className="table__row__item--time">
            {name.renewInBlocks} blocks
            (<Blocktime height={walletHeight + name.renewInBlocks} fromNow prefix />)
          </TableItem>
          : null
        }

        {/* Finalize after */}
        {action === 'transferring' ?
          <TableItem className="table__row__item--time">
            {name.finalizableInBlocks} blocks
            (<Blocktime height={walletHeight + name.finalizableInBlocks} fromNow prefix />)
          </TableItem>
          : null
        }
      </TableRow>
    );
  }
}
