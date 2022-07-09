import React, { Component } from 'react';
import PropTypes from 'prop-types';
import deepEqual from 'deep-equal';
import { TableItem, TableRow } from '../Table';
import { DROPDOWN_TYPES } from '../../ducks/names';
import { deserializeRecord, serializeRecord, validate } from '../../utils/recordHelpers';
import Dropdown from '../Dropdown';

class EditableRecord extends Component {
  static propTypes = {
    className: PropTypes.string,
    record: PropTypes.object.isRequired,
    onEdit: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
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

  componentDidUpdate(prevProps) {
    const {type} = this.props.record || {};
    const currentTypeIndex = DROPDOWN_TYPES.findIndex(d => d.label === type);

    if (!deepEqual(this.props.record, prevProps.record)) {
      this.setState({
        isEditing: false,
        value: serializeRecord(this.props.record),
        errorMessage: '',
        currentTypeIndex: Math.max(currentTypeIndex, 0),
      });
    }
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

    if (this.props.disabled) return;

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
          disabled={this.props.disabled}
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
          disabled={this.props.disabled}
        />
      </TableItem>
    );
  }

  renderEditableRow() {
    const {className = ''} = this.props;
    return (
      <TableRow className={`records-table__create-record ${className}`}>
        <div className="records-table__create-record__error-message">
          {this.state.errorMessage}
        </div>
        <div className="records-table__create-record__inputs">
          {this.renderTypeDropdown()}
          {this.renderInput('value')}
          <TableItem>
            <div className="records-table__actions">
              {
                !this.props.disabled && (
                  <>
                    <button
                      className="records-table__actions__accept"
                      disabled={this.state.errorMessage}
                      onClick={this.editRecord}
                    />
                    <button
                      className="records-table__actions__cancel"
                      onClick={this.cancel}
                    />
                  </>
                )
              }
            </div>
          </TableItem>
        </div>
      </TableRow>
    );
  }

  renderRow() {
    const {className = ''} = this.props;
    return (
      <TableRow className={className}>
        <TableItem className="record__type">{DROPDOWN_TYPES[this.state.currentTypeIndex].label}</TableItem>
        <TableItem className="record__value">{this.state.value}</TableItem>
        <TableItem>
          <div className="records-table__actions">
            {
              !this.props.disabled && (
                <>
                  <div
                    className="records-table__actions__edit"
                    onClick={() => this.setState({isEditing: true})}
                  />
                  <div
                    className="records-table__actions__remove"
                    onClick={this.props.onRemove}
                  />
                </>
              )
            }
          </div>
        </TableItem>
      </TableRow>
    );
  }
}

export default EditableRecord;
