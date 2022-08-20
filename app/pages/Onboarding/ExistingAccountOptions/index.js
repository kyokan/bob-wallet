import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
// import classNames from 'classnames';
import './existing.scss';
import {I18nContext} from "../../../utils/i18n";

const NONE = 0;
const IMPORT_PHRASE = 1;
const IMPORT_XPRIV = 2;
const IMPORT_MASTER = 3;

const OPTIONS = {
  [IMPORT_PHRASE]: {tip: 'obImportOption1Tip', title: 'obImportOption1Title', path: '/import-seed/phrase'},
  [IMPORT_XPRIV]: {tip: 'obImportOption2Tip', title: 'obImportOption2Title', path: '/import-seed/xpriv'},
  [IMPORT_MASTER]: {tip: 'obImportOption3Tip', title: 'obImportOption3Title', path: '/import-seed/master'},
};

@withRouter
class ExistingAccountOptions extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    })
  };

  static contextType = I18nContext;

  state = {
    hovered: NONE
  };

  getTip() {
    const {hovered} = this.state;
    const {t} = this.context;

    if (hovered === NONE)
      return '';

    return t(OPTIONS[hovered].tip);
  }

  render() {
    const {t} = this.context;
    return (
      <div className="existing-options">
        <div className="existing-options__header">
          <i
            className="arrow left"
            onClick={() => this.props.history.push('/funding-options')}
          />
        </div>

        <div className="existing-options__content">
          <div className="existing-options__content__title">
            {t('obImportOptionHeader')}
          </div>

          {Object.entries(OPTIONS).map(([id, option]) => (
            <div
              key={id}
              className="existing-options__content__option"
              onMouseEnter={() => this.setState({ hovered: id })}
              onMouseLeave={() => this.setState({ hovered: NONE })}
              onClick={() => this.props.history.push(option.path)}
            >
              <div className="existing-options__content__option__title">
                {t(option.title)}
              </div>
            </div>
          ))}
        </div>
        <div className="existing-options__footer">
          <div className="existing-options__footer__tip">{this.getTip()}</div>
        </div>
      </div>
    );
  }
}

export default ExistingAccountOptions;
