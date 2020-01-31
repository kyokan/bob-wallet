import React, { Component } from 'react';
import { TableItem, TableRow } from '../../components/Table';
import { deserializeRecord, validate } from '../../utils/recordHelpers';
import { DROPDOWN_TYPES } from '../../ducks/names';
import Dropdown from '../../components/Dropdown';

class CreateRecord extends Component {
  state = {
    isCreating: false,
    currentTypeIndex: 0,
    value: '',
    errorMessage: '',
  };

  cancel = () => {
    this.setState({
      isCreating: false,
      value: '',
      errorMessage: '',
      currentTypeIndex: 0,
    });
  };

  createRecord = () => {
    const {value, currentTypeIndex} = this.state;
    const {label: type} = DROPDOWN_TYPES[currentTypeIndex];

    let record;
    try {
      record = deserializeRecord({ type, value });
    } catch (e) {
      this.setState({ errorMessage: e.message });
      return;
    }

    const errorMessage = validate(record);
    if (errorMessage) {
      this.setState({errorMessage});
      return;
    }

    this.props.onCreate(record).then(() => this.setState({
      isCreating: false,
      currentTypeIndex: 0,
      value: '',
      errorMessage: '',
    })).catch(e => this.setState({
      errorMessage: e.message,
    }));
  };

  render() {
    return this.state.isCreating
      ? this.renderCreationRow()
      : this.renderCreateButton();
  }

  renderTypeDropdown() {
    return (
      <TableItem className="records-table__create-record__record-type-dropdown">
        <Dropdown
          currentIndex={this.state.currentTypeIndex}
          onChange={i => this.setState({currentTypeIndex: i, errorMessage: ''})}
          items={DROPDOWN_TYPES}
        />
      </TableItem>
    );
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
          {this.renderTypeDropdown()}
          {this.renderInput('value')}
          <TableItem>
            <div className="records-table__actions">
              <button
                className="records-table__actions__accept"
                disabled={this.state.errorMessage}
                onClick={this.createRecord}
              />
              <div
                className="records-table__actions__cancel"
                onClick={this.cancel}
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
          onClick={() => this.setState({isCreating: true})}
        >
          Add Record
        </button>
      </TableRow>
    );
  }
}

export default CreateRecord;
