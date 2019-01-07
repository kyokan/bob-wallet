import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import BidStatus from './BidStatus';
import BidTimeLeft from './BidTimeLeft';
import * as bidsActions from '../../ducks/bids';
import { displayBalance } from '../../utils/balances';
import './your-bids.scss';
import BidAction from './BidAction';

class YourBids extends Component {
  static propTypes = {
    yourBids: PropTypes.array.isRequired,
  };

  render() {
    return (
      <div className="bids">
        <Table className="bids-table">
          {this.renderHeaders()}
          {this.renderRows()}
        </Table>
      </div>
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
        <HeaderItem>Your Bid</HeaderItem>
        <HeaderItem />
      </HeaderRow>
    )
  }

  renderRows() {
    const { yourBids } = this.props;

    if (!yourBids.length) {
      return (
        <TableRow className="bids-table__empty-row">
          You have not made any bids yet.
        </TableRow>
      );
    }

    return yourBids.map(bid => (
      <TableRow>
        <TableItem><BidStatus name={bid.name} /></TableItem>
        <TableItem>{`${bid.name}/`}</TableItem>
        <TableItem><BidTimeLeft name={bid.name} /></TableItem>
        <TableItem>{displayBalance(bid.value)}</TableItem>
        <TableItem><BidAction name={bid.name} /></TableItem>
      </TableRow>
    ));
  }
}

export default withRouter(
  connect(
    state => ({
      yourBids: state.bids.yourBids,
    }),
    dispatch => ({
      getYourBids: dispatch(bidsActions.getYourBids()),
    })
  )(YourBids)
);
