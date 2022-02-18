import React, { Component } from 'react';
import PropTypes from 'prop-types';
import connect from 'react-redux/es/connect/connect';
import { withRouter } from 'react-router-dom';
import hip2 from "../../utils/hip2Client";
import './hip2-picker.scss';

@withRouter
@connect(
  (state) => ({
    port: state.hip2.port,
  })
)
export default class Hip2Picker extends Component {
  static propTypes = {
    port: PropTypes.number.isRequired
  }

  constructor (props) {
    super(props);
    console.log(props.port)
    this.state = { port: props.port, invalid: false };
  }

  validate (port) {
    return !!port
  }

  handleChange = e => {
    const port = parseInt(e.target.value)
    if (this.validate(port)) {
      this.setState({ port, invalid: false });
    } else {
      this.setState({ port: '', invalid: true })
    }
  }

  handleSubmit = e => { 
    e.target.children[0].blur()
    e.preventDefault()
  }

  handleBlur = e => {
    const port = this.state.port
    if (port) {
      hip2.setPort(port)
      this.setState({ port, invalid: false })
    } else {
      this.setState({ port: this.props.port, invalid: false })
    }
  }

  render () {
    return (
      <div className="hip2-picker">
        <form onSubmit={this.handleSubmit}>
          <input
            type="number"
            className={`hip2-picker-input ${this.state.invalid ? 'hip2-picker-input-invalid' : ''}`}
            placeholder={this.props.placeholder || ''}
            onChange={this.handleChange}
            onBlur={this.handleBlur}
            value={this.state.port}
          />
        </form>
      </div>
    );
  }
}
