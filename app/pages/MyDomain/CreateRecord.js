import React, { Component } from 'react';
import { TableItem, TableRow } from '../../components/Table';
import { validate } from '../../utils/record-helpers';

class CreateRecord extends Component {
  state = {
    isCreating: false,
    type: '',
    value: '',
    ttl: '',
    errorMessage: '',
  };

  isValid() {
    const { type, value, ttl } = this.state;
    return validate({ type, value, ttl });
  }

  createRecord = () => {
    const errorMessage = this.isValid();

    if (errorMessage) {
      this.setState({ errorMessage });
      return;
    }

    const { type, value, ttl } = this.state;
    this.props.onCreate({ type, value, ttl })
      .then(() => this.setState({
        isCreating: false,
        type: '',
        value: '',
        ttl: '',
        errorMessage: '',
      }))
      .catch(e => this.setState({
        errorMessage: e.message,
      }));
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
          onChange={e => this.setState({
            [name]: e.target.value,
            errorMessage: '',
          })}
        />
      </TableItem>
    );
  }

  renderCreationRow() {
    return (
      <TableRow className="records-table__create-record">
        <div className="records-table__create-record__error-message">
          {this.state.errorMessage}
        </div>
        <div className="records-table__create-record__inputs">
          {this.renderInput('type')}
          {this.renderInput('value')}
          {this.renderInput('ttl')}
          <TableItem>
            <div className="records-table__actions">
              <button
                className="records-table__actions__accept"
                disabled={this.state.errorMessage}
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
        </div>
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
