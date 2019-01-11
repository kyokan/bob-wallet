import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { TableItem, TableRow } from '../../components/Table';
import { RECORD_TYPE, DROPDOWN_TYPES } from '../../ducks/names';
import { validate } from '../../utils/record-helpers';
import Dropdown from '../../components/Dropdown';

class EditableRecord extends Component {
  static propTypes = {
    record: PropTypes.shape({
      type: PropTypes.string,
      name: PropTypes.string,
      data: PropTypes.object,
      ttl: PropTypes.number,
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    const { type, value, ttl } = props.record | {};
    const currentTypeIndex = DROPDOWN_TYPES.findIndex(d => d.label === type);
    this.state = {
      isEditing: false,
      value,
      ttl,
      errorMessage: '',
      currentTypeIndex: Math.max(currentTypeIndex, 0),
    };
  }

  isValid() {
    const { value, ttl, currentTypeIndex } = this.state;
    const {label: type} = DROPDOWN_TYPES[currentTypeIndex];
    return validate({ type, value, ttl });
  }

  cancel = () => {
    const { type, value, ttl } = this.props.record || {};
    const currentTypeIndex = DROPDOWN_TYPES.findIndex(d => d.label === type);
    this.setState({
      isEditing: false,
      value,
      ttl,
      errorMessage: '',
      currentTypeIndex: Math.max(currentTypeIndex, 0),
    });
  };

  editRecord = () => {
    const errorMessage = this.isValid();

    if (errorMessage) {
      this.setState({ errorMessage });
      return;
    }

    const { value, ttl, currentTypeIndex } = this.state;
    const {label: type} = DROPDOWN_TYPES[currentTypeIndex];
    this.props.onEdit({ type, value, ttl })
      .then(() => this.setState({
        isEditing: false,
        errorMessage: '',
      }))
      .catch(e => this.setState({
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
          onChange={i => this.setState({ currentTypeIndex: i, errorMessage: '' })}
          items={DROPDOWN_TYPES}
        />
      </TableItem>
    )
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
          {/*{this.renderInput('type')}*/}
          {this.renderTypeDropdown()}
          {this.renderInput('value')}
          {this.renderInput('ttl')}
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
    const { record } = this.props;
    const { type, value, ttl } = record || {};

    return (
      <TableRow>
        <TableItem>{type}</TableItem>
        <TableItem>{value}</TableItem>
        <TableItem>{ttl}</TableItem>
        <TableItem>
          <div className="records-table__actions">
            <div
              className="records-table__actions__edit"
              onClick={() => this.setState({ isEditing: true })}
            />
            <div
              className="records-table__actions__remove"
              onClick={() => this.props.onRemove({ type, value, ttl })}
            />
          </div>
        </TableItem>
      </TableRow>
    );
  }
}

export default EditableRecord;

function getRecordJson(record) {
  const json = record.getJSON();
  const type = json.type;
  const ttl = json.ttl;

  let value = '';

  if ([RECORD_TYPE.A, RECORD_TYPE.AAAA].includes(type)) {
    value = json.data.address;
  }

  if (type === RECORD_TYPE.CNAME) {
    value = json.data.target;
  }

  return { type, value, ttl };
}
