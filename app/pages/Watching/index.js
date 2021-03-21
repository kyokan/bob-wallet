import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import c from 'classnames';
import './watching.scss';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import BidStatus from '../YourBids/BidStatus';
import BidTimeLeft from '../YourBids/BidTimeLeft';
import * as watchingActions from '../../ducks/watching';
import BidSearchInput from '../../components/BidSearchInput';
import Fuse from '../../vendor/fuse';
import PropTypes from 'prop-types';
import { formatName } from '../../utils/nameHelpers';
import { clientStub as aClientStub } from '../../background/analytics/client';
import fs from "fs";
import Dropdown from "../../components/Dropdown";
import {getPageIndices} from "../../utils/pageable";
import {verifyName} from "../../utils/nameChecker";
import dbClient from "../../utils/dbClient";
const {dialog} = require('electron').remote;

const analytics = aClientStub(() => require('electron').ipcRenderer);

const ITEM_PER_DROPDOWN = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
];

const WATCHING_ITEMS_PER_PAGE_KEY = 'watching-items-per-page';

class Watching extends Component {
  static propTypes = {
    network: PropTypes.string.isRequired,
    names: PropTypes.arrayOf(PropTypes.string).isRequired,
    addNames: PropTypes.func.isRequired,
    addName: PropTypes.func.isRequired,
    removeName: PropTypes.func.isRequired,
  };

  state = {
    name: '',
    isAddingName: false,
    query: '',
    showError: false,
    currentPageIndex: 0,
    itemsPerPage: 10,
    isConfirmingReset: false,
    isImporting: false,
  };

  async componentWillMount() {
    const itemsPerPage = await dbClient.get(WATCHING_ITEMS_PER_PAGE_KEY);

    this.setState({
      itemsPerPage: itemsPerPage || 10,
    });
  }

  componentDidMount() {
    analytics.screenView('Watching');
  }

  handleOnChange = e => this.setState({
    query: e.target.value,
    isConfirmingReset: false,
  });

  onImport = async () => {
    this.setState({
      isConfirmingReset: false,
      isImporting: true,
    });

    try {
      const {
        filePaths: [filepath]
      } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: {
          name: 'spreadsheet',
          extensions: ['csv'],
        },
      });

      const buf = await fs.promises.readFile(filepath);
      const content = buf.toString('utf-8');
      const importedNames = content.split('\n');
      const {addNames, network, names} = this.props;
      const newNames = [];

      for (const importedName of importedNames) {
        const name = importedName.replace(/[^ -~]+/g, "");
        if (verifyName(name) && names.indexOf(name) === -1) {
          newNames.push(name);
        }
      }

      await addNames(newNames, network);
      this.fuse = null;

      this.setState({
        isImporting: false,
      });
    } catch (e) {
      this.setState({
        isImporting: false,
      });
    }

  };

  onDownload = () => {
    this.setState({isConfirmingReset: false});
    const names = this.props.names;
    const data = names.join('\n');

    const savePath = dialog.showSaveDialogSync({
      filters: [{name: 'spreadsheet', extensions: ['csv']}],
    });

    if (savePath) {
      fs.writeFile(savePath, data, (err) => {
        if (err) {
          throw err;
        }
      });
    }
  };

  onAdd = async () => {
    this.setState({isConfirmingReset: false});
    if (verifyName(this.state.name) && this.props.names.indexOf(this.state.name) === -1) {
      await this.props.addName(this.state.name, this.props.network);
      this.fuse = null;
      this.onClose();
      analytics.track('watched domain', {
        source: 'Watching',
      });
    } else {
      return this.setState({showError: true});
    }
  };

  onReset = async () => {
    const {isConfirmingReset} = this.state;
    const {network, reset} = this.props;

    if (isConfirmingReset) {
      await reset(network);
      this.setState({isConfirmingReset: false});
    } else {
      this.setState({isConfirmingReset: true});
    }
  };

  onClose = () => this.setState({isAddingName: false, name: ''});

  getText = () => {
    const {
      isConfirmingReset,
      isImporting,
    } = this.state;

    if (isConfirmingReset) {
      return 'Unless previously exported, this will permanently delete your watchlist.';
    }

    if (isImporting) {
      return <span className="watching__loader">Importing watchlist...</span>;
    }

    return '';
  };

  render() {
    const {
      isConfirmingReset,
      isImporting,
      query,
    } = this.state;
    return (
      <div className="watching">
        <div className="watching__actions">
          <BidSearchInput
            className="watching__search"
            onChange={this.handleOnChange}
            value={query}
          />
          <div className="watching__warning-text">
            {this.getText()}
          </div>
          {
            !isConfirmingReset && (
              <button
                className="watching__import"
                onClick={this.onImport}
                disabled={isImporting}
              >
                Import
              </button>
            )
          }
          {
            !isConfirmingReset && (
              <button
                className="watching__download"
                onClick={this.onDownload}
                disabled={isImporting}
              >
                Export
              </button>
            )
          }
          {
            isConfirmingReset && (
              <button
                className="watching__cancel"
                onClick={() => this.setState({ isConfirmingReset: false })}
              >
                Cancel
              </button>
            )
          }
          <button
            className={c("watching__reset", {
              'watching__reset--confirming': isConfirmingReset,
            })}
            onClick={this.onReset}
            disabled={isImporting}
          >
            {isConfirmingReset ? 'Confirm Reset' : 'Reset'}
          </button>
        </div>
        <Table className="watching-table">
          {this.renderHeaders()}
          {this.renderCreationRow()}
          {this.renderRows()}
          {this.renderControls()}
        </Table>
      </div>
    );
  }

  renderCreationContent() {
    return this.state.isAddingName
      ? (
        <div className="watching-table__create-row__form">
          <div className={c('watching-table__create-row__form__input', {
            'watching-table__create-row__form__input--error': this.state.showError,
          })}>
            <input
              value={this.state.name}
              onChange={e => this.setState({showError: false, name: e.target.value})}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  this.onAdd();
                }

                if (e.key === 'Escape') {
                  this.onClose();
                }
              }}
            />
          </div>
          <div className="watching-table__create-row__actions">
            <button
              className="watching-table__create-row__form__cta"
              onClick={this.onAdd}
            >
              Accept
            </button>
            <div
              className="watching-table__create-row__form__remove"
              onClick={this.onClose}
            />
          </div>
        </div>
      )
      : (
        <button
          className="watching-table__create-row__cta"
          onClick={() => this.setState({isAddingName: true})}
        >
          Add To Watchlist
        </button>
      );
  }

  renderCreationRow() {
    return (
      <TableRow className="watching-table__create-row">
        {this.renderCreationContent()}
      </TableRow>
    );
  }

  renderHeaders() {
    return (
      <HeaderRow>
        <HeaderItem>
          <div>Status</div>
        </HeaderItem>
        <HeaderItem>TLD</HeaderItem>
        <HeaderItem>Time Left</HeaderItem>
        <HeaderItem />
      </HeaderRow>
    );
  }

  renderGoTo() {
    const { currentPageIndex, itemsPerPage } = this.state;
    const { names } = this.props;
    const totalPages = Math.ceil(names.length / itemsPerPage);

    return (
      <div className="domain-manager__page-control__dropdowns">
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">Items per Page:</div>
          <Dropdown
            className="domain-manager__go-to__dropdown transactions__items-per__dropdown"
            items={ITEM_PER_DROPDOWN}
            onChange={async itemsPerPage => {
              await dbClient.put(WATCHING_ITEMS_PER_PAGE_KEY, itemsPerPage);
              this.setState({
                itemsPerPage,
                currentPageIndex: 0,
              })
            }}
            currentIndex={ITEM_PER_DROPDOWN.findIndex(({ value }) => {
              return value === this.state.itemsPerPage;
            })}
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
      names,
    } = this.props;

    const totalPages = Math.ceil(names.length / itemsPerPage);
    const pageIndices = getPageIndices(names, itemsPerPage, currentPageIndex);

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
        {this.renderGoTo()}
      </div>
    )
  }

  renderRows() {
    const {names, history} = this.props;
    const {query, currentPageIndex: s, itemsPerPage: n } = this.state;

    if (!names.length) {
      return <EmptyResult />;
    }

    if (!this.fuse) {
      this.fuse = new Fuse(names.map(name => ({name})), {
        keys: ['name'],
      });
    }
    const results = query
      ? this.fuse.search(query).map(({name}) => name)
      : names;

    if (!results.length) {
      return <EmptyResult />;
    }

    const start = s * n;
    const end = start + n;

    return results.slice(start, end).map(name => (
      <TableRow
        key={name}
        onClick={() => history.push(`/domain/${name}`)}
      >
        <TableItem>
          <BidStatus name={name} />
        </TableItem>
        <TableItem>{formatName(name)}</TableItem>
        <TableItem>
          <BidTimeLeft name={name} />
        </TableItem>
        <TableItem>
          <div
            className="watching-table__remove-icon"
            onClick={e => {
              e.stopPropagation();
              this.props.removeName(name, this.props.network);
              analytics.track('unwatched name', {
                source: 'Watching',
              });
            }}
          />
        </TableItem>
      </TableRow>
    ));
  }
}

export default withRouter(
  connect(
    state => ({
      names: state.watching.names,
      network: state.node.network,
    }),
    dispatch => ({
      addName: (name, network) => dispatch(watchingActions.addName(name, network)),
      addNames: (names, network) => dispatch(watchingActions.addNames(names, network)),
      removeName: (name, network) => dispatch(watchingActions.removeName(name, network)),
      reset: (network) => dispatch(watchingActions.reset(network)),
    }),
  )(Watching),
);

function EmptyResult() {
  return (
    <TableRow className="watching-table__empty-row">
      No results found
    </TableRow>
  );
}
