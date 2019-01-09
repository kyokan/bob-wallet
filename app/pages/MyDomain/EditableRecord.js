import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { TableItem, TableRow } from '../../components/Table';
import { RECORD_TYPE } from '../../ducks/names';
import { validate } from '../../utils/record-helpers';

class EditableRecord extends Component {
  static propTypes = {
    record: PropTypes.shape({
      type: PropTypes.number,
      name: PropTypes.string,
      data: PropTypes.object,
      ttl: PropTypes.number,
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    const { type, value, ttl } = getRecordJson(props.record);
    this.state = {
      isEditing: false,
      type,
      value,
      ttl,
      errorMessage: '',
    };
  }

  isValid() {
    const { type, value, ttl } = this.state;
    return validate({ type, value, ttl });
  }

  editRecord = () => {
    const errorMessage = this.isValid();

    if (errorMessage) {
      this.setState({ errorMessage });
      return;
    }

    const { type, value, ttl } = this.state;
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
          {this.renderInput('type')}
          {this.renderInput('value')}
          {this.renderInput('ttl')}
          <TableItem>
            <div className="records-table__actions">
              <button
                className="records-table__actions__accept"
                disabled={this.state.errorMessage}
                onClick={this.editRecord}
              >
                Accept
              </button>
              <div
                className="records-table__actions__remove"
                onClick={() => this.setState({
                  isEditing: false,
                  ...getRecordJson(this.props.record),
                })}
              />
            </div>
          </TableItem>
        </div>
      </TableRow>
    );
  }

  renderRow() {
    const { record } = this.props;
    const { type, value, ttl } = getRecordJson(record);

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
