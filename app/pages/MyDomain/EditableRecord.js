import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { TableItem, TableRow } from '../../components/Table';
import { RECORD_TYPE } from '../../ducks/names';

class EditableRecord extends Component {
  static propTypes = {
    record: PropTypes.shape({
      type: PropTypes.string,
      name: PropTypes.string,
      data: PropTypes.object,
      ttl: PropTypes.number,
    }).isRequired,
  };

  state = {
    isEditing: false,
    type: undefined,
    name: undefined,
    value: undefined,
    ttl: undefined,
  };


  render() {
    return this.state.isEditing
      ? this.renderEditableRow()
      : this.renderRow();
  }

  renderInput(name) {
    const { record } = this.props;
    const json = record.getJSON();
    let defaultValue = '';

    if (name === 'type') {
      defaultValue = json.type;
    }

    if (name === 'name') {
      defaultValue = json.name;
    }

    if (name === 'ttl') {
      defaultValue = json.ttl;
    }

    if (name === 'value') {
      if (json.type === 'A') {
        defaultValue = json.data.address;
      }
    }

    return (
      <TableItem>
        <input
          type="text"
          value={this.state[name]}
          defaultValue={defaultValue}
          onChange={e => this.setState({ [name]: e.target.value })}
        />
      </TableItem>
    );
  }

  renderEditableRow() {
    const { type, name, value, ttl } = this.state;
    return (
      <TableRow className="records-table__create-record">
        {this.renderInput('type')}
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
              onClick={() => this.setState({
                isEditing: false,
                type: undefined,
                name: undefined,
                value: undefined,
                ttl: undefined,
              })}
            />
          </div>
        </TableItem>
      </TableRow>
    );
  }

  renderRow() {
    const { record } = this.props;
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
          </div>
        </TableItem>
      </TableRow>
    );
  }
}

export default EditableRecord;
