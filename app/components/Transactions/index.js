// import React, { Component } from 'react';
// import { connect } from 'react-redux';
// import PropTypes from 'prop-types';
//
// import Transaction from './Transaction';
// import './index.scss';
//
// // Dummy transactions state until we have ducks
// import { transactionsDummyOrder } from '../../utils/mockingTransactionsState';
//
// @connect(state => ({
//   transactionsDummyOrder: transactionsDummyOrder || []
// }))
// export default class Transactions extends Component {
//   static propTypes = {
//     transactionsDummyOrder: PropTypes.array.isRequired
//   };
//
//   render() {
//     return transactionsDummyOrder && transactionsDummyOrder.map ? (
//       transactionsDummyOrder.map(txId => (
//         <div className="transaction__container" key={txId}>
//           <Transaction transactionId={txId} />
//         </div>
//       ))
//     ) : (
//       <div className="account__empty-list">You do not have any transactions</div>
//     );
//   }
// }
//
// //TODO: Connect component to Redux and grab transactionsOrder directly
