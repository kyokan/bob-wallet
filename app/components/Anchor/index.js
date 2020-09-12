import React from "react";
import {shell} from "electron";
import "./index.scss";

export default function Anchor(props) {
  const {
    href = '',
    children,
  } = props;

  return (
    <a
      className="anchor"
      onClick={() => shell.openExternal(href)}
    >
      {children}
    </a>
  )
}
