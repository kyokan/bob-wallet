import React, { Component } from 'react';
import { TableItem, TableRow } from '../../components/Table';

class CreateRecord extends Component {
  state = {
    isCreating: false,
    type: '',
    name: '',
    value: '',
    ttl: '',
  };


  render() {
    return this.state.isCreating
      ? this.renderCreationRow()
      : this.renderCreateButton();
  }

  renderInput(name) {
    return (
      <TableItem>
        <input
          type="text"
          value={this.state[name]}
          onChange={e => this.setState({ [name]: e.target.value })}
        />
      </TableItem>
    );
  }

  renderCreationRow() {
    const { type, name, value, ttl } = this.state;
    return (
      <TableRow className="records-table__create-record">
        {this.renderInput('type')}
        {this.renderInput('name')}
        {this.renderInput('value')}
        {this.renderInput('ttl')}
        <TableItem>
          <div className="records-table__actions">
            <button
              className="records-table__actions__accept"
              disabled={!type || !name || !value || !ttl}
            >
              Accept
            </button>
            <div
              className="records-table__actions__remove"
              onClick={() => this.setState({ isCreating: false })}
            />
          </div>
        </TableItem>
      </TableRow>
    );
  }

  renderCreateButton() {
    return (
      <TableRow className="records-table__create-record">
        <button
          className="records-table__create-record__create-btn"
          onClick={() => this.setState({ isCreating: true })}
        >
          Add Record
        </button>
      </TableRow>
    );
  }
}

export default CreateRecord;
