import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import { TableItem, TableRow } from '../../components/Table';
import { RECORD_TYPE } from '../../ducks/names';

class CreateRecord extends Component {
  state = {
    isCreating: false,
    type: '',
    value: '',
    ttl: '',
  };

  isValid() {
    const { type, value, ttl } = this.state;
    console.log(!RECORD_TYPE[type], typeof value, typeof ttl)
    if (!RECORD_TYPE[type]) {
      return false;
    }

    if (typeof value !== 'string') {
      return false;
    }

    if (isNaN(ttl)) {
      return false;
    }

    return true;
  }

  createRecord = () => {
    const { type, value, ttl } = this.state;
    this.props.sendUpdate(this.props.name, { type, value, ttl });
    // this.setState({ isCreating: true })
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
    return (
      <TableRow className="records-table__create-record">
        {this.renderInput('type')}
        {this.renderInput('value')}
        {this.renderInput('ttl')}
        <TableItem>
          <div className="records-table__actions">
            <button
              className="records-table__actions__accept"
              disabled={!this.isValid()}
              onClick={this.createRecord}
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

export default connect(
  null,
  dispatch => ({
    sendUpdate: (name, json) => dispatch(nameActions.sendUpdate(name, json)),
  })
)(CreateRecord);
