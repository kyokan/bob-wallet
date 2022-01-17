import React, { Component } from 'react';
import MiniModal from '../../components/Modal/MiniModal.js';
import { connect } from 'react-redux';
import { getMyNames } from '../../ducks/myDomains.js';
import Dropdown from '../../components/Dropdown';
import { transferExchangeLock } from '../../ducks/exchange.js';
import Anchor from "../../components/Anchor";
import Alert from "../../components/Alert";
import {I18nContext} from "../../utils/i18n";

export class PlaceListingModal extends Component {
  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.durationOpts = [1, 3, 5, 7, 14];

    this.state = {
      startPrice: '',
      endPrice: '',
      nameIdx: 0,
      durationIdx: 0,
      errorMessage: '',
    };
  }

  componentDidMount() {
    this.props.getMyNames();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.isPlacingListing && !this.props.isPlacingListing && !this.props.isPlacingListingError) {
      this.props.onClose();
    }

    if (prevProps.names !== this.props.names) {
      this.setState({
        name: this.props.names[0]
      });
      return;
    }
  }

  createListing = async () => {
    try {
      await this.props.transferExchangeLock(
        this.props.names[this.state.nameIdx],
        Number(this.state.startPrice) * 1e6,
        Number(this.state.endPrice) * 1e6,
        this.durationOpts[this.state.durationIdx]
      );
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
    }
  };

  render() {
    const {onClose, names} = this.props;
    const {t} = this.context;

    const isValid = this.state.startPrice.length &&
      this.state.endPrice.length &&
      Number(this.state.startPrice) > 0 &&
      Number(this.state.endPrice) > 0 &&
      Number(this.state.startPrice) > Number(this.state.endPrice);

    return (
      <MiniModal title={t('createListing')} onClose={onClose}>
        <div className="exchange__place-listing-modal">
          <p>
            {t('shakedexCreateListingNote')}
          </p>
          <p>
            <Anchor href="https://github.com/kurumiimari/shakedex#selling-a-name">{t('learnMore')}</Anchor>
          </p>
          <div className="exchange__label">{`${t('chooseName')}:`}</div>
          <div className="exchange__input">
            <Dropdown
              items={names.map(n => ({
                label: n,
              }))}
              onChange={(i) => this.setState({
                nameIdx: i,
                errorMessage: '',
              })}
              currentIndex={this.state.nameIdx}
            />
          </div>

          <label className="exchange__label">{`${t('startingPrice')}:`}</label>
          <div className="exchange__input send__input">
            <input
              type="number"
              value={this.state.startPrice}
              onChange={(e) => this.setState({
                startPrice: e.target.value,
                errorMessage: '',
              })}
            />
          </div>

          <label className="exchange__label">{`${t('endingPrice')}:`}</label>
          <div className="exchange__input send__input">
            <input
              type="number"
              value={this.state.endPrice}
              onChange={(e) => this.setState({
                endPrice: e.target.value,
                errorMessage: '',
              })}
            />
          </div>

          <label className="exchange__label">{`${t('duration')}:`}</label>
          <Dropdown
            items={this.durationOpts.map(d => ({
              label: `${d} ${t('days')}`,
            }))}
            onChange={(i) => this.setState({
              durationIdx: i,
              errorMessage: '',
            })}
            currentIndex={this.state.durationIdx}
          />
          <Alert type="error" message={this.state.errorMessage} />
          <div className="place-bid-modal__buttons">
            <button
              className="place-bid-modal__cancel"
              onClick={onClose}
              disabled={this.props.isPlacingListing}
            >
              {t('cancel')}
            </button>

            <button
              className="place-bid-modal__send"
              onClick={this.createListing}
              disabled={this.props.isPlacingListing || !isValid}
            >
              {this.props.isPlacingListing ? t('loading') : t('placeListing')}
            </button>
          </div>
        </div>
      </MiniModal>
    );
  }
}

export default connect(
  (state) => ({
    isFetchingNames: state.myDomains.isFetching,
    names: Object.keys(state.myDomains.names),
    isPlacingListing: state.exchange.isPlacingListing,
    isPlacingListingError: state.exchange.isPlacingListingError,
  }),
  (dispatch) => ({
    getMyNames: () => dispatch(getMyNames()),
    transferExchangeLock: (name, startPrice, endPrice, durationDays) => dispatch(transferExchangeLock(
      name,
      startPrice,
      endPrice,
      durationDays,
    )),
  }),
)(PlaceListingModal);
