import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMoney} from '../dist/money-format.js';
import {buildRequestLink,parseRequestLink} from '../dist/share-links.js';

test('money display has two decimals in both locales without modifying source values',()=>{
  for(const [value,en,ru] of [[0,'0.00','0,00'],[12,'12.00','12,00'],[12.345678,'12.35','12,35'],[0.000001,'0.00','0,00']]){
    assert.equal(formatMoney(value,'en'),en);
    assert.equal(formatMoney(value,'ru'),ru);
  }
  assert.equal(formatMoney(NaN),'—');
  const order={id:'HS-money-test',status:'searching',amount:12.345678,minReceive:12.123456,partial:false,give:{currency:'USDT',method:'crypto',network:'TRC20'},receive:{currency:'USDC',method:'crypto',network:'Solana'}};
  const restored=parseRequestLink(buildRequestLink(order));
  assert.equal(restored.amount,12.345678);
  assert.equal(restored.minReceive,12.123456);
});
