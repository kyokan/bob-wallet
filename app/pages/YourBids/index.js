import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import BidStatus from './BidStatus';
import BidTimeLeft from './BidTimeLeft';
import BidAction from './BidAction';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import BidSearchInput from '../../components/BidSearchInput';
import { displayBalance } from '../../utils/balances';
import { formatName } from '../../utils/nameHelpers';
import Fuse from '../../vendor/fuse';
import './your-bids.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);


class YourBids extends Component {
  static propTypes = {
    yourBids: PropTypes.array.isRequired,
  };

  state = {
    query: '',
  };

  componentDidMount() {
    analytics.screenView('Your Bids');
  }

  handleOnChange = e => this.setState({ query: e.target.value });

  render() {
    return (
      <div className="bids">
        <BidSearchInput
          className="bids__search"
          onChange={this.handleOnChange}
          value={this.state.query}
        />
        <Table className="bids-table">
          <Header />
          {this.renderRows()}
        </Table>
      </div>
    );
  }

  renderRows() {
    const { yourBids, history } = this.props;
    const { query } = this.state;

    if (!yourBids.length) {
      return <EmptyResult />;
    }

    if (!this.fuse) {
      this.fuse = new Fuse(yourBids, {
        keys: ['name'],
      });
    }
    const bids = query ? this.fuse.search(query) : yourBids;

    if (!bids.length) {
      return <EmptyResult />;
    }

    return bids.map((bid, i) => (
      <TableRow key={`${bid.name}-${i}`} onClick={() => history.push(`/domain/${bid.name}`)}>
        <TableItem><BidStatus name={bid.name} /></TableItem>
        <TableItem>{formatName(bid.name)}</TableItem>
        <TableItem><BidTimeLeft name={bid.name} /></TableItem>
        <TableItem>{`${+displayBalance(bid.value)} HNS`}</TableItem>
        <TableItem><BidAction name={bid.name} /></TableItem>
      </TableRow>
    ));
  }
}

export default withRouter(
  connect(
    state => ({
      yourBids: state.bids.yourBids,
    })
  )(YourBids)
);

function Header() {
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

function EmptyResult() {
  return (
    <TableRow className="bids-table__empty-row">
      No Bids Found
    </TableRow>
  );
}
