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
import { verifyName } from '../../utils/nameChecker';
import { formatName } from '../../utils/nameHelpers';
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

class Watching extends Component {

  state = {
    name: '',
    isAddingName: false,
    query: '',
    showError: false,

  };

  componentDidMount() {
    analytics.screenView('Watching');
  }

  handleOnChange = e => this.setState({query: e.target.value});

  onDownload = () => {
    const csvContent = `data:text/csv;charset=utf-8,${this.props.names.join(',')}\r\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'allison_and_bob_watchlist.csv');
    document.body.appendChild(link); // Required for FF
    link.click();
    link.remove();
  };

  onAdd = () => {
    if (verifyName(this.state.name) && this.props.names.indexOf(this.state.name) === -1) {
      this.props.addName(this.state.name, this.props.network);
      this.onClose();
      analytics.track('watched domain', {
        source: 'Watching',
      });
    } else {
      return this.setState({showError: true});
    }
  };

  onClose = () => this.setState({isAddingName: false, name: ''});

  render() {
    return (
      <div className="watching">
        <div className="watching__actions">
          <BidSearchInput
            className="watching__search"
            onChange={this.handleOnChange}
            value={this.state.query}
          />
          <div className="watching__warning-text">
            Your watchlist does not transfer across devices!
          </div>
          <div className="watching__download" onClick={this.onDownload}>
            <div className="watching__download__icon" />
            <div className="watching__download__link">
              Download Watchlist
            </div>
          </div>
        </div>
        <Table className="watching-table">
          {this.renderHeaders()}
          {this.renderCreationRow()}
          {this.renderRows()}
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

  renderRows() {
    const {names, history} = this.props;
    const {query} = this.state;

    if (!names.length) {
      return <EmptyResult />;
    }

    if (!this.fuse) {
      this.fuse = new Fuse(names.map(name => ({name})), {
        keys: ['name'],
      });
    }
    const results = query ?
      this.fuse.search(query).map(({name}) => name)
      : names;

    if (!results.length) {
      return <EmptyResult />;
    }

    return results.map(name => (
      <TableRow key={name} onClick={() => history.push(`/domain/${name}`)}>
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
      removeName: (name, network) => dispatch(watchingActions.removeName(name, network)),
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
