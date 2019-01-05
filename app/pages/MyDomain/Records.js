import React, { Component } from 'react';
import { Table, HeaderRow, HeaderItem, TableRow, TableItem } from '../../components/Table';

class Records extends Component {

  renderHeaders() {
    return (
      <HeaderRow>
        <HeaderItem>
          <div>Type</div>
        </HeaderItem>
        <HeaderItem>Name</HeaderItem>
        <HeaderItem>Value</HeaderItem>
        <HeaderItem>TTL</HeaderItem>
      </HeaderRow>
    )
  }

  renderRows() {
    const mock = [
      {type: 'A', name: '@', value: '97.75.45.79', ttl: '60' },
      {type: 'A', name: '@', value: '97.75.45.79', ttl: '60' },
      {type: 'A', name: '@', value: '97.75.45.79', ttl: '60' },
      {type: 'A', name: '@', value: '97.75.45.79', ttl: '60' },
      {type: 'A', name: '@', value: '97.75.45.79', ttl: '60' },
    ];

    return mock.map(({ type, name, value, ttl }) => (
      <TableRow>
        <TableItem>{type}</TableItem>
        <TableItem>{name}</TableItem>
        <TableItem>{value}</TableItem>
        <TableItem>{ttl}</TableItem>
      </TableRow>
    ));
  }

  render() {
    return (
      <div>
        <Table className="records-table">
          {this.renderHeaders()}
          {this.renderRows()}
        </Table>
      </div>
    )
  }
}

export default Records;
