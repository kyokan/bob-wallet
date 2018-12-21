const transactionsDummyArray = [
  {
    id: 1,
    type: 'sent',
    date: 1542033412,
    pending: true,
    receiver: '1G83fdm3HUXrCNLbtMDqcw6o5GNn4xqX',
    value: 5.0,
    balance: 7499.00075
  },
  {
    id: 2,
    type: 'received',
    date: 1542032412,
    pending: false,
    sender: '1G83fdm3HUXrCNLbtMDqcw6o5GNn4xqX',
    value: 7500,
    balance: 7501.00075
  },
  {
    id: 3,
    type: 'received',
    date: 1542013054,
    pending: false,
    sender: '1G83fdm3HUXrCNLbtMDqcw6o5GNn4xqX',
    value: 1,
    balance: 1.00075
  },
  {
    id: 4,
    type: 'sent',
    date: 1542012054,
    pending: false,
    receiver: '1G83fdm3HUXrCNLbtMDqcw6o5GNn4xqX',
    value: 0.00025,
    balance: 0.00075
  },
  {
    id: 5,
    type: 'received',
    date: 1542011054,
    pending: false,
    sender: '1G83fdm3HUXrCNLbtMDqcw6o5GNn4xqX',
    value: 1.0,
    balance: 1.0
  }
];

// creating order array
const transactionsDummyOrder = transactionsDummyArray.map(tx => tx.id);

// creating lookup map
const transactionsDummyMap = {};
transactionsDummyArray.forEach(tx => {
  transactionsDummyMap[tx.id] = tx;
});

export { transactionsDummyArray, transactionsDummyOrder, transactionsDummyMap };
