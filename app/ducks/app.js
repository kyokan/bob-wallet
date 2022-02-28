import semver from 'semver';
const pkg = require('../../package.json');
import settingsClient from "../utils/settingsClient";
import hip2Client from '../utils/hip2Client';
import { SET_HIP2_PORT } from "./hip2Reducer";

const SET_DEEPLINK = 'app/setDeeplink';
const SET_LOCALE = 'app/setLocale';
const SET_CUSTOM_LOCALE = 'app/setCustomLocale';
const SET_DEEPLINK_PARAMS = 'app/setDeeplinkParams';
const SET_UPDATE_AVAILABLE = 'app/setUpdateAvailable';

const initialState = {
  deeplink: '',
  deeplinkParams: {},
  locale: '',
  customLocale: null,
  updateAvailable: null,
};

export const checkForUpdates = () => async (dispatch) => {
  const latestRelease = await settingsClient.getLatestRelease();
  if (!latestRelease) return;

  const canUpdate = semver.gt(latestRelease.tag_name.replace(/$v/i, ''), pkg.version);
  if (canUpdate) {
    dispatch({
      type: SET_UPDATE_AVAILABLE,
      payload: {
        version: latestRelease.tag_name,
        url: latestRelease.html_url,
      },
    });
  }
};

export const initHip2 = () => async (dispatch) => {
  dispatch({
    type: SET_HIP2_PORT,
    payload: await hip2Client.getPort()
  })
}

export const fetchLocale = () => async dispatch => {
  const locale = await settingsClient.getLocale();
  const customLocale = await settingsClient.getCustomLocale();
  if (customLocale) {
    try {
      dispatch(setCustomLocale(JSON.parse(customLocale)));
    } catch (e) {}
    return;
  }
  dispatch(setLocale(locale));
};

export const setLocale = locale => async (dispatch) => {
  await settingsClient.setLocale(locale);
  dispatch({
    type: SET_LOCALE,
    payload: locale,
  });
};

export const setCustomLocale = json => async (dispatch) => {
  if (!json) {
    dispatch({
      type: SET_CUSTOM_LOCALE,
      payload: null,
    });
    return;
  }

  await settingsClient.setCustomLocale(json);
  dispatch({
    type: SET_LOCALE,
    payload: 'custom',
  });
  dispatch({
    type: SET_CUSTOM_LOCALE,
    payload: json,
  });
};

export const setDeeplink = url => ({
  type: SET_DEEPLINK,
  payload: url,
});

export const clearDeeplink = () => ({
  type: SET_DEEPLINK,
  payload: '',
});

export const setDeeplinkParams = params => ({
  type: SET_DEEPLINK_PARAMS,
  payload: params,
});

export const clearDeeplinkParams = () => ({
  type: SET_DEEPLINK_PARAMS,
  payload: {},
});

export default function appReducer(state = initialState, action) {
  switch (action.type) {
    case SET_DEEPLINK:
      return {
        ...state,
        deeplink: action.payload,
      };
    case SET_DEEPLINK_PARAMS:
      return {
        ...state,
        deeplinkParams: action.payload,
      };
    case SET_LOCALE:
      return {
        ...state,
        locale: action.payload,
      };
    case SET_CUSTOM_LOCALE:
      return {
        ...state,
        customLocale: action.payload,
      };
    case SET_UPDATE_AVAILABLE:
      return {
        ...state,
        updateAvailable: action.payload,
      };
    default:
      return state;
  }
}
