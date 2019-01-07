import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import './watching.scss';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import BidStatus from '../YourBids/BidStatus';
import BidTimeLeft from '../YourBids/BidTimeLeft';
import * as watchingActions from '../../ducks/watching';

class Watching extends Component {

  state = {
    isAddingName: false,
  };

  componentWillMount() {
    this.props.getWatching();
  }

  render() {
    return (
      <div className="watching">
        <Table className="watching-table">
          {this.renderHeaders()}
          {this.renderCreationRow()}
          {this.renderRows()}
        </Table>
      </div>
    );
  }

  renderCreationContent () {
    return this.state.isAddingName
      ? (
        <div className="watching-table__create-row__form">
          <div className="watching-table__create-row__form__input">
            <input
              value={this.state.name}
              onChange={e => this.setState({ name: e.target.value })}
            />
          </div>
          <div className="watching-table__create-row__actions">
            <button
              className="watching-table__create-row__form__cta"
              onClick={() => {
                this.props.addName(this.state.name);
                this.setState({
                  isAddingName: false,
                  name: '',
                });
              }}
            >
              Accept
            </button>
            <div
              className="watching-table__create-row__form__remove"
              onClick={() => this.setState({
                isAddingName: false,
                name: '',
              })}
            />
          </div>
        </div>
      )
      : (
        <button
          className="watching-table__create-row__cta"
          onClick={() => this.setState({ isAddingName: true })}
        >
          Add To Watchlist
        </button>
      )
  }

  renderCreationRow() {
    return(
      <TableRow className="watching-table__create-row">
        {this.renderCreationContent()}
      </TableRow>
    )
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
    )
  }

  renderRows() {
    const { names } = this.props;

    if (!names.length) {
      return (
        <TableRow className="watching-table__empty-row">
          Your watch list is empty.
        </TableRow>
      );
    }

    return names.map(name => (
      <TableRow>
        <TableItem>
          <BidStatus name={name} />
        </TableItem>
        <TableItem>{`${name}/`}</TableItem>
        <TableItem>
          <BidTimeLeft name={name} />
        </TableItem>
        <TableItem>
          <div
            className="watching-table__remove-icon"
            onClick={() => this.props.removeName(name)}
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
    }),
    dispatch => ({
      getWatching: () => dispatch(watchingActions.getWatching()),
      addName: name => dispatch(watchingActions.addName(name)),
      removeName: name => dispatch(watchingActions.removeName(name)),
    })
  )(Watching),
);
