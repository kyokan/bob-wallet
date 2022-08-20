// import React from 'react';
// const test = require('tape');
// const sinon = require('sinon');
// import {mount} from 'enzyme';
// import {RepairBid} from "../RepairBid";
// import {createMockStore} from "../../../utils/test-helpers";

// test('<RepairBid>', async t => {
//   const getNameInfoStub = sinon.stub();
//   const showErrorStub = sinon.stub();
//   const store = createMockStore();
//   let calls = 0;
//   const wrapper = mount(
//     <RepairBid
//       bid={{
//         name: 'test',
//         from: 'ts1q8tlzrx9lq9an302cju5q6msjnr06564sd9fnj9'
//       }}
//       getNameInfo={getNameInfoStub}
//       showError={showErrorStub}
//       store={store}
//     />,
//   );

//   const verifyBidSpy = sinon.stub(RepairBid.prototype, 'verifyBid');

//   const div = wrapper.find('div').at(0);
//   div.props().onClick();

//   wrapper.update();

//   testOneRepair('1234');
//   testOneRepair('0');

//   t.end();

//   function testOneRepair(text) {
//     const input = wrapper.find('input').at(0);
//     input.props().onChange({
//       target: {
//         value: `${text}`,
//       },
//     });

//     wrapper.update();

//     t.equal(
//       verifyBidSpy.getCall(calls++).args[0],
//       Number(text),
//       `it should submit verifyBid for ${text}`,
//     );
//   }
// });
