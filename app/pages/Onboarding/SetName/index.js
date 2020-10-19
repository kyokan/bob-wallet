import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import './create.scss';
import Submittable from '../../../components/Submittable';
import WizardHeader from '../../../components/WizardHeader';

@connect()
export default class CreatePassword extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      name: '',
    };
  }

  onSubmit = () => {
    this.props.onNext(this.state.name);
  };

  isValidName = () => {
    return this.state.name.match(/^[a-z0-9]+$/);
  };

  onChange = name => e => {
    this.setState({
      [name]: e.target.value,
    });
  };

  render() {
    const {currentStep, totalSteps, onBack} = this.props;

    return (
      <div className="create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={this.props.onCancel}
        />
        <div className="create-password__content">
          <Submittable onSubmit={this.onSubmit}>
            <div className="create-password__header_text">
              Name this wallet
            </div>
            <div className="create-password__body-text">
              The name can only contain alphanumeric lowercase characters.
            </div>
            <div
              className={c('create-password__input')}
            >
              <input
                type="text"
                placeholder="Enter a name"
                value={this.state.name}
                onChange={this.onChange('name')}
                autoFocus
              />
            </div>
          </Submittable>
        </div>
        <div className="create-password__footer">
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={!this.isValidName()}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}
