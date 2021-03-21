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
import {displayBalance} from "../../utils/balances";
import {getPageIndices} from "../../utils/pageable";
import c from "classnames";
import Dropdown from "../../components/Dropdown";
import dbClient from "../../utils/dbClient";

const {dialog} = require('electron').remote;

const analytics = aClientStub(() => require('electron').ipcRenderer);

const ITEM_PER_DROPDOWN = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
];

const DM_ITEMS_PER_PAGE_KEY = 'domain-manager-items-per-page';

class DomainManager extends Component {
  static propTypes = {
    isFetching: PropTypes.bool.isRequired,
    getMyNames: PropTypes.func.isRequired,
    namesList: PropTypes.array.isRequired,
    names: PropTypes.object.isRequired,
  };

  state = {
    isShowingNameClaimForPayment: false,
    currentPageIndex: 0,
    itemsPerPage: 10,
  };

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.namesList.join('') !== nextProps.namesList.join('')
      || this.props.isFetching !== nextProps.isFetching
      || this.state.isShowingNameClaimForPayment !== nextState.isShowingNameClaimForPayment
      || this.state.currentPageIndex !== nextState.currentPageIndex
      || this.state.itemsPerPage !== nextState.itemsPerPage;
  }

  componentDidMount() {
    analytics.screenView('Domain Manager');
  }

  async componentWillMount() {
    this.props.getMyNames();
    const itemsPerPage = await dbClient.get(DM_ITEMS_PER_PAGE_KEY);

    this.setState({
      itemsPerPage: itemsPerPage || 10,
    });
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

  renderGoTo(namesList) {
    const { currentPageIndex, itemsPerPage } = this.state;
    const totalPages = Math.ceil(namesList.length / itemsPerPage);
    return (
      <div className="domain-manager__page-control__dropdowns">
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">Items per Page:</div>
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
          <div className="domain-manager__go-to__text">Page</div>
          <Dropdown
            className="domain-manager__go-to__dropdown"
            items={Array(totalPages).fill(0).map((_, i) => ({ label: `${i + 1}` }))}
            onChange={currentPageIndex => this.setState({ currentPageIndex })}
            currentIndex={currentPageIndex}
          />
          <div className="domain-manager__go-to__total">of {totalPages}</div>
        </div>
      </div>
    )
  }

  renderControls() {
    const {
      currentPageIndex,
      itemsPerPage,
    } = this.state;
    const {
      namesList,
    } = this.props;

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
                onClick={() => this.setState({ currentPageIndex: pageIndex })}
              >
                {pageIndex + 1}
              </div>
            )
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
    )
  }

  renderList() {
    const {namesList, history} = this.props;
    const {
      currentPageIndex: i,
      itemsPerPage: n,
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
            Export All Names
          </button>
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={() => this.setState({
              isShowingNameClaimForPayment: true,
            })}
          >
            Claim Name For Payment
          </button>
        </div>
        <Table className="domain-manager__table">
          <HeaderRow>
            <HeaderItem>TLD</HeaderItem>
            <HeaderItem>Expiry</HeaderItem>
            <HeaderItem>HNS Paid</HeaderItem>
          </HeaderRow>
          {namesList.slice(start, end).map((name) => {
            return (
              <DomainRow
                key={`${name}`}
                name={name}
                onClick={() => history.push(`/domain_manager/${name}`)}
              />
            );
          })}
        </Table>
      </div>
    );
  }

  renderEmpty() {
    return (
      <div className="domain-manager">
        <div className="domain-manager__buttons">
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={() => this.setState({
              isShowingNameClaimForPayment: true,
            })}
          >
            Claim Name For Payment
          </button>
        </div>
        <div className="domain-manager__empty-text">
          You do not own any domains.
        </div>
      </div>
    );
  }

  renderBody() {
    const { namesList, isFetching } = this.props;

    if (isFetching) {
      return (
        <div className="domain-manager">
          <div className="domain-manager__loading">
            {`Loading ${namesList.length} domains...`}
          </div>
        </div>
      )
    }

    if (namesList.length) {
      return this.renderList();
    }

    return this.renderEmpty();
  }

  render() {
    return (
      <>
        {this.renderBody()}
        {this.renderControls()}
        {this.state.isShowingNameClaimForPayment && (
          <ClaimNameForPayment
            onClose={() => this.setState({
              isShowingNameClaimForPayment: false,
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
    }),
    dispatch => ({
      getMyNames: () => dispatch(myDomainsActions.getMyNames()),
    }),
  )(DomainManager),
);


const DomainRow = connect(
  state => ({
    names: state.myDomains.names,
  }),
)(_DomainRow);

function _DomainRow(props) {
  const { name, names, onClick } = props;
  return (
    <TableRow key={`${name}`} onClick={onClick}>
      <TableItem>{formatName(name)}</TableItem>
      <TableItem>
        <Blocktime
          height={names[name].height + 105120}
          format="ll"
          fromNow
        />
      </TableItem>
      <TableItem>{displayBalance(names[name].highest, true)}</TableItem>
    </TableRow>
  )
}
