import React, { Component } from "react";
import PropTypes from "prop-types";
import Dropdown from "../../components/Dropdown";
import { withRouter } from "react-router-dom";
import connect from "react-redux/es/connect/connect";
import * as nodeActions from "../../ducks/node";
import c from "classnames";
import "./explorer-picker.scss";
import { EXPLORERS } from '../../constants/explorers';

@withRouter
@connect(
  (state) => ({
    explorer: state.node.explorer,
  }),
  (dispatch) => ({
    changeExplorer: (explorer) => dispatch(nodeActions.setExplorer(explorer)),
  })
)
export default class ExplorerPicker extends Component {
  static propTypes = {
    explorer: PropTypes.object.isRequired,
    changeExplorer: PropTypes.func.isRequired,
    className: PropTypes.string,
  };

  render() {
    const {
      explorer,
      changeExplorer,
      className,
    } = this.props;

    return (
      <div className={c("explorer-picker", className)}>
        <Dropdown
          reversed
          items={EXPLORERS}
          currentIndex={EXPLORERS.findIndex((x) => x.label == explorer.label)}
          onChange={(i) => {
            changeExplorer(EXPLORERS[i]);
          }}
        />
      </div>
    );
  }
}
