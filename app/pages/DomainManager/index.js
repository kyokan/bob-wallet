import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as myDomainsActions from '../../ducks/myDomains';
import { formatName } from '../../utils/nameHelpers';
import './domain-manager.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';
import fs from 'fs';
import ClaimNameForPayment from './ClaimNameForPayment';
import {HeaderItem, HeaderRow, Table, TableItem, TableRow} from "../../components/Table";
import Blocktime from "../../components/Blocktime";
import BidSearchInput from "../../components/BidSearchInput";
import BulkActionConfirmModal from "../../components/BulkActionConfirmModal";
import {displayBalance} from "../../utils/balances";
import {getPageIndices} from "../../utils/pageable";
import c from "classnames";
import Checkbox from '../../components/Checkbox';
import Dropdown from "../../components/Dropdown";
import BulkTransfer from "./BulkTransfer";
import * as networks from "hsd/lib/protocol/networks";
import {showError, showSuccess} from "../../ducks/notifications";
import dbClient from "../../utils/dbClient";
import {I18nContext} from "../../utils/i18n";

const {dialog} = require('@electron/remote');

const analytics = aClientStub(() => require('electron').ipcRenderer);

const ITEM_PER_DROPDOWN = [
  {label: '5', value: 5},
  {label: '10', value: 10},
  {label: '20', value: 20},
  {label: '50', value: 50},
];

const DM_ITEMS_PER_PAGE_KEY = 'domain-manager-items-per-page';

class DomainManager extends Component {
  static propTypes = {
    isFetching: PropTypes.bool.isRequired,
    getMyNames: PropTypes.func.isRequired,
    namesList: PropTypes.array.isRequired,
    names: PropTypes.object.isRequired,
  };

  static contextType = I18nContext;

  state = {
    query: '',
    isShowingNameClaimForPayment: false,
    isShowingBulkTransfer: false,
    currentPageIndex: 0,
    itemsPerPage: 10,
    selected: [],
    bulkAction: {
      isShowing: false,
      action: null,
    }
  };

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.namesList.join('') !== nextProps.namesList.join('')
      || this.props.isFetching !== nextProps.isFetching
      || this.state.query !== nextState.query
      || this.state.isShowingNameClaimForPayment !== nextState.isShowingNameClaimForPayment
      || this.state.isShowingBulkTransfer !== nextState.isShowingBulkTransfer
      || this.state.bulkAction.isShowing !== nextState.bulkAction.isShowing
      || this.state.currentPageIndex !== nextState.currentPageIndex
      || this.state.selected.length !== nextState.selected.length
      || this.state.itemsPerPage !== nextState.itemsPerPage;
  }

  async componentDidMount() {
    this.props.getMyNames();
    const itemsPerPage = await dbClient.get(DM_ITEMS_PER_PAGE_KEY);

    this.setState({
      itemsPerPage: itemsPerPage || 10,
    });

    analytics.screenView('Domain Manager');
  }

  onChange = (name) => (e) => {
    this.setState({
      [name]: e.target.value,
    });
  };

  getNamesList() {
    let namesList = Array.from(this.props.namesList);
    let { query } = this.state;

    if (query) {
      query = query.toLowerCase();
      namesList = namesList.filter(name => name.includes(query));
    }

    namesList.sort();
    return namesList;
  }

  handleExportClick() {
    let names = this.props.namesList;
    let data = names.join('\n');

    let savePath = dialog.showSaveDialogSync({
      filters: [{name: 'spreadsheet', extensions: ['csv']}],
    });

    if (savePath) {
      fs.writeFile(savePath, data, (err) => {
        if (err) {
          throw err;
        }
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
      const withoutName = state.selected.filter(x => x !== name);

      if (isSelected) {
        return { selected: [...withoutName, name] }
      } else {
        return { selected: withoutName }
      }
    });
  }

  renderGoTo(namesList) {
    const {currentPageIndex, itemsPerPage} = this.state;
    const { t } = this.context;

    const totalPages = Math.ceil(namesList.length / itemsPerPage);
    return (
      <div className="domain-manager__page-control__dropdowns">
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">{`${t('itemsPerPage')}:`}</div>
          <Dropdown
            className="domain-manager__go-to__dropdown transactions__items-per__dropdown"
            items={ITEM_PER_DROPDOWN}
            onChange={async itemsPerPage => {
              await dbClient.put(DM_ITEMS_PER_PAGE_KEY, itemsPerPage);
              this.setState({
                itemsPerPage,
                currentPageIndex: 0,
              })
            }}
            currentIndex={ITEM_PER_DROPDOWN.findIndex(({ value }) => value === this.state.itemsPerPage)}
          />
        </div>
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">{t('page')}</div>
          <Dropdown
            className="domain-manager__go-to__dropdown"
            items={Array(totalPages).fill(0).map((_, i) => ({label: `${i + 1}`}))}
            onChange={currentPageIndex => this.setState({currentPageIndex})}
            currentIndex={currentPageIndex}
          />
          <div className="domain-manager__go-to__total">of {totalPages}</div>
        </div>
      </div>
    );
  }

  renderControls(namesList) {
    const {
      currentPageIndex,
      itemsPerPage,
    } = this.state;

    const totalPages = Math.ceil(namesList.length / itemsPerPage);
    const pageIndices = getPageIndices(namesList, itemsPerPage, currentPageIndex);

    return (
      <div className="domain-manager__page-control">
        <div className="domain-manager__page-control__numbers">
          <div
            className="domain-manager__page-control__start"
            onClick={() => this.setState({
              currentPageIndex: Math.max(currentPageIndex - 1, 0),
            })}
          />
          {pageIndices.map((pageIndex, i) => {
            if (pageIndex === '...') {
              return (
                <div key={`${pageIndex}-${i}`} className="domain-manager__page-control__ellipsis">...</div>
              );
            }

            return (
              <div
                key={`${pageIndex}-${i}`}
                className={c('domain-manager__page-control__page', {
                  'domain-manager__page-control__page--active': currentPageIndex === pageIndex,
                })}
                onClick={() => this.setState({currentPageIndex: pageIndex})}
              >
                {pageIndex + 1}
              </div>
            );
          })}
          <div
            className="domain-manager__page-control__end"
            onClick={() => this.setState({
              currentPageIndex: Math.min(currentPageIndex + 1, totalPages - 1),
            })}
          />
        </div>
        {this.renderGoTo(namesList)}
      </div>
    );
  }

  renderList(namesList) {
    const {history} = this.props;
    const {t} = this.context;
    const {
      query,
      currentPageIndex: i,
      itemsPerPage: n,
      selected,
    } = this.state;

    const start = i * n;
    const end = start + n;

    return (
      <div className="domain-manager">
        <div className="domain-manager__buttons">
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={this.handleExportClick.bind(this)}
          >
            {t('export')}
          </button>
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={() => this.setState({
              isShowingNameClaimForPayment: true,
            })}
          >
            {t('claimPaidTransfer')}
          </button>
        </div>
        
        <div className="domain-manager__search-row">
          <BidSearchInput
            className="domain-manager__search"
            placeholder={t('domainSearchPlaceholder')}
            onChange={this.onChange('query')}
            value={query}
          />
          {selected.length ? <>
            <span>{selected.length} selected:</span>
            <div className="domain-manager__buttons-multiselect">
              <button onClick={() => this.setState({
                isShowingBulkTransfer: true,
              })}>
                {t('transfer')}
              </button>
              <button onClick={() => this.setState({
                bulkAction: {
                  isShowing: true,
                  action: 'renew',
                },
              })}>
                {t('renew')}
              </button>
            </div>
            </>: null
          }
        </div>

        <Table className="domain-manager__table">
          <HeaderRow>
            <HeaderItem className="table__header__item--checkbox"></HeaderItem>
            <HeaderItem className="table__header__item--domain">{t('domain')}</HeaderItem>
            <HeaderItem className="table__header__item--expiry">{t('expiresOn')}</HeaderItem>
            <HeaderItem className="table__header__item--value">{t('hnsPaid')}</HeaderItem>
          </HeaderRow>
          {namesList.length ? namesList.slice(start, end).map((name) => {
            return (
              <DomainRow
                key={`${name}`}
                name={name}
                onClick={() => history.push(`/domain_manager/${name}`)}
                isSelected={selected.includes(name)}
                onSelectChange={(isSelected) => this.updateNameSelect(name, isSelected)}
              />
            );
          }) :
          <TableRow className="table__empty-row">
            {t('domainManagerEmpty')}
          </TableRow>}
        </Table>
      </div>
    );
  }

  renderEmpty() {
    const { t } = this.context;
    return (
      <div className="domain-manager">
        <div className="domain-manager__buttons">
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={() => this.setState({
              isShowingNameClaimForPayment: true,
            })}
          >
            {t('claimNamePaymentTitle')}
          </button>
        </div>
        <div className="domain-manager__empty-text">
          {t('domainManagerEmpty')}
        </div>
      </div>
    );
  }

  renderBody(namesList) {
    const {isFetching} = this.props;
    const { t } = this.context;

    if (isFetching) {
      return (
        <div className="domain-manager">
          <div className="domain-manager__loading">
            {t('loadingNDomains', namesList.length)}
          </div>
        </div>
      );
    }

    return this.renderList(namesList);
  }

  render() {
    const {
      selected,
      isShowingBulkTransfer,
      isShowingNameClaimForPayment,
      bulkAction,
    } = this.state;
    const namesList = this.getNamesList();

    return (
      <>
        {this.renderBody(namesList)}
        {this.renderControls(namesList)}
        {isShowingBulkTransfer && (
          <BulkTransfer
            transferNames={selected}
            onClose={() => this.setState({
              isShowingBulkTransfer: false,
            })}
          />
        )}
        {isShowingNameClaimForPayment && (
          <ClaimNameForPayment
            onClose={() => this.setState({
              isShowingNameClaimForPayment: false,
            })}
          />
        )}
        {bulkAction.isShowing && (
          <BulkActionConfirmModal
            action={bulkAction.action}
            canSelect={false}
            customList={selected.map(name => ({name}))}
            onClose={() => this.setState({
              bulkAction: {
                isShowing: false,
                action: null,
              },
            })}
          />
        )}
      </>
    );
  }
}

export default withRouter(
  connect(
    state => ({
      names: state.myDomains.names,
      isFetching: state.myDomains.isFetching,
      namesList: Object.keys(state.myDomains.names),
      height: state.node.chain.height,
      network: state.wallet.network,
      wid: state.wallet.wid,
    }),
    dispatch => ({
      getMyNames: () => dispatch(myDomainsActions.getMyNames()),
      showSuccess: (message) => dispatch(showSuccess(message)),
      showError: (message) => dispatch(showError(message)),
    }),
  )(DomainManager),
);


const DomainRow = connect(
  state => ({
    names: state.myDomains.names,
    network: state.wallet.network,
  }),
)(_DomainRow);

function _DomainRow(props) {
  const { name, names, onClick, network, isSelected, onSelectChange } = props;
  return (
    <TableRow key={`${name}`} onClick={onClick}>
      <TableItem className="table__row__item--checkbox">
        <Checkbox
          checked={isSelected}
          onChange={(e) => {
            onSelectChange(e.currentTarget.checked)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </TableItem>
      <TableItem className="table__row__item--domain">{formatName(name)}</TableItem>
      <TableItem className="table__row__item--expiry">
        <Blocktime
          height={names[name].renewal + networks[network].names.renewalWindow}
          format="ll"
          fromNow
        />
      </TableItem>
      <TableItem className="table__row__item--value">{displayBalance(names[name].value, true)}</TableItem>
    </TableRow>
  );
}
