import React, {Component} from 'react';
import './vickrey-process.scss';
import {shell} from "electron";
import {I18nContext} from "../../utils/i18n";

export default class VickreyProcess extends Component {
  static contextType = I18nContext;

  render() {
    const {t} = this.context;
    return (
      <div className="vickrey-process">
        <p>
          {t('vickreyProcess1')}
        </p>
        <p>
          {t('vickreyProcess2')}
        </p>
        <ul>
          <li>{t('vickreyProcessItem1')}</li>
          <li>{t('vickreyProcessItem2')}</li>
          <li>{t('vickreyProcessItem3')}</li>
          <li>{t('vickreyProcessItem4')}</li>
          <li>{t('vickreyProcessItem5')}</li>
          <li>{t('vickreyProcessItem6')}</li>
          <li>{t('vickreyProcessItem7')}</li>
          <li>{t('vickreyProcessItem8')}</li>
        </ul>
        <p>
          <div
            className="link"
            onClick={() => shell.openExternal('https://handshake.org/files/handshake.txt')}
          >
            {t('vickreyProcessFooter')}
          </div>
        </p>
      </div>
    );
  }

}
