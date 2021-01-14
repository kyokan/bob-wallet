import React, { Component } from "react";
import PropTypes from "prop-types";
import Dropdown from "../../components/Dropdown";
import { withRouter } from "react-router-dom";
import connect from "react-redux/es/connect/connect";
import * as nodeActions from "../../ducks/node";
import c from "classnames";
import "./explorer-picker.scss";


export const explorers = [
  {
    label: 'HNScan',
    tx: 'https://hnscan.com/tx/%s',
    name: 'https://hnscan.com/name/%s',
  },
  {
    label: 'HNS Network',
    tx: 'https://hnsnetwork.com/txs/%s',
    name: 'https://hnsnetwork.com/names/%s',
  },
  {
    label: 'Shake Scan',
    tx: 'https://shakescan.com/transaction/%s',
    name: 'https://shakescan.com/name/%s',
  },
  {
    label: 'HNS Fans',
    tx: 'https://e.hnsfans.com/tx/%s',
    name: 'https://e.hnsfans.com/name/%s',
  },
  {
    label: 'Handshake Explorer',
    tx: 'https://hnsxplorer.com/tx/%s',
    name: 'https://hnsxplorer.com/name/%s',
  },
];

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
          items={explorers}
          currentIndex={explorers.findIndex((x) => x.label == explorer.label)}
          onChange={(i) => {
            // console.log("Change explorer to", explorers[i]);
            changeExplorer(explorers[i]);
          }}
        />
      </div>
    );
  }
}
