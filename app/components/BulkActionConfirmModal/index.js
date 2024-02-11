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

// values are i18n keys
const TITLES = {
  register: 'register',
  finalize: 'finalize',
  renew: 'renew',
  transferring: 'transferring',
};

const MAX_LIMITS = {
  register: consensus.MAX_BLOCK_RENEWALS / 6,
  finalize: consensus.MAX_BLOCK_RENEWALS / 6,
  renew: consensus.MAX_BLOCK_RENEWALS / 6,
}

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
    canSelect: PropTypes.bool,
    customList: PropTypes.array,
    onClose: PropTypes.func.isRequired,
    onRefresh: PropTypes.func,

    walletHeight: PropTypes.number.isRequired,
    finalizableExchangeListings: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  static defaultProps = {
    canSelect: true,
    customList: null,
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
    const { action, customList } = this.props;

    try {
      const names = customList ?? await walletClient.getNamesForBulkAction(action);
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
    const shouldShowAction = action !== 'transferring';
    const canDoAction = selectedNames.length && !errors;

    return (
      <MiniModal
        title={t(TITLES[action])}
        onClose={onClose}
        className="bulk-action"
        overflow
      >
        {/* Errors */}
        {errors}

        {/* Names list */}
        {this.renderNames()}

        {/* Do action */}
        {shouldShowAction ?
          <div className="bulk-action__actions">
            <button
              disabled={!canDoAction}
              onClick={this.doAction}
            >
              {t(TITLES[action])} {selectedNames.length} {t('domains')}
            </button>
          </div>
          : null
        }
      </MiniModal>
    );
  }

  renderErrors() {
    const { action, finalizableExchangeListings } = this.props;
    const { selectedNames, errorMessage } = this.state;
    const { t } = this.context;

    const errors = [];

    // Errors thrown when doing action
    if (errorMessage) {
      errors.push(errorMessage);
    }

    // Max limit per batch
    const maxLimit = MAX_LIMITS[action];
    if (selectedNames.length > maxLimit) {
      errors.push(t('bulkActionErrorMaxLimit', maxLimit));
    }

    // Shakedex needs to generate presigns so
    // don't allow finalizing with regular transfers
    const selectedExchangeNames = selectedNames.filter(
      name => finalizableExchangeListings.includes(name)
    );
    if (selectedExchangeNames.length) {
      errors.push(
        t('bulkActionErrorFinalizeExchangeName', selectedExchangeNames.length)
        + ': '
        + selectedExchangeNames.join(', ')
      );
    }

    // TODO: don't allow finalizing atomic swap finalizes
    // We first need to mark transfers with intent and then check here
    // https://github.com/kyokan/bob-wallet/issues/501

    if (errors.length === 0) {
      return null;
    }

    return errors.map((error, idx) => (
      <Alert type="error" key={idx}>{error}</Alert>
    ));
  }

  renderNames() {
    const { action, canSelect } = this.props;
    const { selectableNames } = this.state;
    const { t } = this.context;

    const isSelectable = canSelect && action !== 'transferring';

    return (
      <Table className="bulk-action__table">
        <HeaderRow>
          {isSelectable ?
            <HeaderItem className="table__header__item--checkbox"></HeaderItem>
            : null
          }

          <HeaderItem className="table__header__item--domain">{t('domainsPlural')}</HeaderItem>

          {action === 'renew' && selectableNames?.[0]?.renewInBlocks ?
            <HeaderItem className="table__header__item--time">{t('expiresIn')}</HeaderItem>
            : null
          }

          {action === 'transferring' ?
            <HeaderItem className="table__header__item--time">{t('finalizeIn')}</HeaderItem>
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
    const { action, canSelect, walletHeight } = this.props;
    const { selectedNames } = this.state;
    const { t } = this.context;

    const isSelectable = canSelect && action !== 'transferring';

    return (
      <TableRow key={idx}>

        {/* Checkbox */}
        {isSelectable ?
          <TableItem className="table__row__item--checkbox">
            <Checkbox
              checked={selectedNames.includes(name.name)}
              onChange={(e) => this.updateNameSelect(name.name, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
          </TableItem>
          : null
        }

        {/* Name */}
        <TableItem className="table__row__item--domain">{name.name}/</TableItem>

        {/* Renew within */}
        {action === 'renew' && name.renewInBlocks ?
          <TableItem className="table__row__item--time">
            {name.renewInBlocks} {t('blocksPlural')} {' '}
            (<Blocktime height={walletHeight + name.renewInBlocks} fromNow prefix />)
          </TableItem>
          : null
        }

        {/* Finalize after */}
        {action === 'transferring' ?
          <TableItem className="table__row__item--time">
            {name.finalizableInBlocks} {t('blocksPlural')} {' '}
            (<Blocktime height={walletHeight + name.finalizableInBlocks} fromNow prefix />)
          </TableItem>
          : null
        }
      </TableRow>
    );
  }
}
