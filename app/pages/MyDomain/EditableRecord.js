import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { TableItem, TableRow } from '../../components/Table';
import { DROPDOWN_TYPES } from '../../ducks/names';
import { deserializeRecord, serializeRecord, validate } from '../../utils/recordHelpers';
import Dropdown from '../../components/Dropdown';

class EditableRecord extends Component {
  static propTypes = {
    record: PropTypes.object.isRequired,
    onEdit: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    const {type} = props.record || {};
    const currentTypeIndex = DROPDOWN_TYPES.findIndex(d => d.label === type);
    this.state = {
      isEditing: false,
      value: serializeRecord(props.record),
      errorMessage: '',
      currentTypeIndex: Math.max(currentTypeIndex, 0),
    };
  }

  componentWillReceiveProps(props) {
    const {type} = props.record || {};
    const currentTypeIndex = DROPDOWN_TYPES.findIndex(d => d.label === type);
    this.setState({
      isEditing: false,
      value: serializeRecord(props.record),
      errorMessage: '',
      currentTypeIndex: Math.max(currentTypeIndex, 0),
    });
  }

  cancel = () => {
    const {type} = this.props.record || {};
    const currentTypeIndex = DROPDOWN_TYPES.findIndex(d => d.label === type);
    this.setState({
      isEditing: false,
      value: serializeRecord(this.props.record),
      errorMessage: '',
      currentTypeIndex: Math.max(currentTypeIndex, 0),
    });
  };

  editRecord = () => {
    const {value, currentTypeIndex} = this.state;
    const {label: type} = DROPDOWN_TYPES[currentTypeIndex];

    let record;
    try {
      record = deserializeRecord({type, value});
    } catch (e) {
      this.setState({errorMessage: e.message});
      return;
    }

    const errorMessage = validate(record);
    if (errorMessage) {
      this.setState({errorMessage});
      return;
    }

    this.props.onEdit(record).then(() => this.setState({
      isEditing: false,
      errorMessage: '',
    })).catch(e => this.setState({
      errorMessage: e.message,
    }));
  };

  render() {
    return this.state.isEditing
      ? this.renderEditableRow()
      : this.renderRow();
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

  renderEditableRow() {
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
                onClick={this.editRecord}
              />
              <button
                className="records-table__actions__cancel"
                onClick={this.cancel}
              />
            </div>
          </TableItem>
        </div>
      </TableRow>
    );
  }

  renderRow() {
    return (
      <TableRow>
        <TableItem>{DROPDOWN_TYPES[this.state.currentTypeIndex].label}</TableItem>
        <TableItem>{this.state.value}</TableItem>
        <TableItem>
          <div className="records-table__actions">
            <div
              className="records-table__actions__edit"
              onClick={() => this.setState({isEditing: true})}
            />
            <div
              className="records-table__actions__remove"
              onClick={this.props.onRemove}
            />
          </div>
        </TableItem>
      </TableRow>
    );
  }
}

export default EditableRecord;
