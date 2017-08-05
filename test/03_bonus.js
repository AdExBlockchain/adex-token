var ADXToken = artifacts.require("./ADXToken.sol");
var Promise = require('bluebird')
var time = require('../helpers/time')


contract('ADXToken', function(accounts) {

  var crowdsale;

  var EXPECT_FOR_ONE_ETH = 11700000; // 900*1.3*10000
  var EXPECT_FOR_ONE_ETH_WEEK = 900*1.15*10000;
  var EXPECT_FOR_ONE_ETH_MONTH = 900*10000;

  var ownerAddr = web3.eth.accounts[1];
  var adexTeamAddr = web3.eth.accounts[9];
  var adexFundAddr = web3.eth.accounts[8];

  var participiants = web3.eth.accounts.slice(3, 8).map(account => {
    return {
      account: account,
      sent: web3.toWei(1, 'ether')
    }
  })

  var blockchainDate = function() {
    return web3.eth.getBlock(web3.eth.blockNumber).timestamp
  }

  var newSC = function(startDate) {
    return ADXToken.new(
      ownerAddr, // multisig
      adexTeamAddr, // team, whre 2% wings and 2% bounty will be received
      startDate, // public sale start
      startDate-7*24*60*60, // private sale start
      web3.toWei(4, 'ether'), // ETH hard cap, in wei
      web3.eth.accounts[1], 5047335,
      web3.eth.accounts[2], 5047335, // TODO: change accordingly
      web3.eth.accounts[3], 2340000 
    )
  }

  it("initialize contract", function() {
    return newSC(blockchainDate()).then(function() { // ugly hack to get latest block (+timestamp) updated :( )
      var startDate = blockchainDate()
      return newSC(startDate)
    })
    .then(function(_crowdsale) {
      crowdsale = _crowdsale
    })
  });

  it("should start with 0 eth", function() {
    return crowdsale.etherRaised.call()
    .then(function(eth) {
      assert.equal(eth.valueOf(), 0);
    })
  });

  function testExchange(idx, price) {
    return () => {
      const currentParticipiants = [participiants[idx]]

      return Promise.all(currentParticipiants.map(participiant => {
        return new Promise((resolve, reject) => {
          web3.eth.sendTransaction({
            from: participiant.account,
            to: crowdsale.address,
            value: participiant.sent,
            gas: 130000
          }, (err) => {
            if (err) reject(err) 
            
            crowdsale.balanceOf(participiant.account).then(function(res) {
              //console.log(res.valueOf(), price);
              assert.equal(res.valueOf(), price);
              resolve()
            }).catch(reject)

          })
        })
      }))
    }
  }

  it('Should allow to send ETH in exchange of Tokens - first day', testExchange(1, EXPECT_FOR_ONE_ETH))

  it('Change time to first week bonus', () => {
    return new Promise((resolve, reject) => {
         web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [3*24*60*60 + 30],
          id: new Date().getTime()
        }, (err, result) => {
          err ? reject(err) : resolve()
        })
    })
  })

  it('Should allow to send ETH in exchange of Tokens - first week', testExchange(2, EXPECT_FOR_ONE_ETH_WEEK))

  it('Change time to first month', () => {
    return new Promise((resolve, reject) => {
         web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [7*24*60*60 + 30],
          id: new Date().getTime()
        }, (err, result) => {
          err ? reject(err) : resolve()
        })
    })
  })

  it('Should allow to send ETH in exchange of Tokens - regular price', testExchange(3, EXPECT_FOR_ONE_ETH_MONTH))

  it('Change time to end of crowdsale', () => {
    return new Promise((resolve, reject) => {
         web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [30*24*60*60 + 30],
          id: new Date().getTime()
        }, (err, result) => {
          err ? reject(err) : resolve()
        })
    })
  })


});
