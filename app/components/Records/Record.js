import React, {Component} from "react";
import PropTypes from "prop-types";
import {TableItem, TableRow} from "../../components/Table";
import {DROPDOWN_TYPES} from "../../ducks/names";
import {serializeRecord} from "../../utils/recordHelpers";
import classNames from 'classnames';

class Record extends Component {
  static propTypes = {
    className: PropTypes.string,
    record: PropTypes.object.isRequired,
  };

  render() {
    const value = serializeRecord(this.props.record);
    const {type} = this.props.record || {};
    const currentTypeIndex = DROPDOWN_TYPES.findIndex((d) => d.label === type);

    return (
      <TableRow className={classNames(this.props.className)}>
        <TableItem className="record__type">{DROPDOWN_TYPES[currentTypeIndex].label}</TableItem>
        <TableItem className="record__value">{value}</TableItem>
      </TableRow>
    );
  }
}

export default Record;
