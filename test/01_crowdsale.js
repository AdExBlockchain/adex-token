var ADXToken = artifacts.require("./ADXToken.sol");
var Promise = require('bluebird')
var time = require('../helpers/time')

contract('ADXToken', function(accounts) {

  var crowdsale;

  var EXPECT_FOR_ONE_ETH = 11700000;

  var startDate;
  var ownerAddr = web3.eth.accounts[0];
  var adexTeamAddr1 = web3.eth.accounts[7]; // wings dao, bounties
  var adexTeamAddr2 = web3.eth.accounts[9]; // vested tokens
  var adexFundAddr = web3.eth.accounts[8];
  var prebuyAddr = web3.eth.accounts[1]; 

  // accounts 4, 5
  var participiants = web3.eth.accounts.slice(4, 6).map(account => {
    return {
      account: account,
      sent: web3.toWei(1, 'ether')
    }
  })

  it("initialize contract", function() {
    return time.blockchainTime(web3)
    .then(function(startDate) {

      return ADXToken.new(
        ownerAddr, // multisig
        adexTeamAddr1, // team, whre 2% wings and 2% bounty will be received
        startDate+7*24*60*60, // public sale start
        startDate, // private sale start
        web3.toWei(30800, 'ether'), // ETH hard cap, in wei
        web3.eth.accounts[1], 5047335,
        web3.eth.accounts[2], 2053388, 
        web3.eth.accounts[3], 2340000
      )
    }).then(function(_crowdsale) {
      crowdsale = _crowdsale
    })
  });

  it("should start with 0 eth", function() {
    return crowdsale.etherRaised.call()
    .then(function(eth) {        
        assert.equal(eth.valueOf(), 0);
    })
  });

  it("pre-buy state: cannot send ETH in exchange for tokens", function() {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction({
          from: prebuyAddr,
          to: crowdsale.address,
          value: web3.toWei(1, 'ether'),
          gas: 130000
        }, function(err, res) {
            if (!err) return reject(new Error('Cant be here'))
            assert.equal(err.message, 'VM Exception while processing transaction: invalid opcode')
            resolve()
        })
    })
  });

  it("pre-buy state: cannot send ETH in exchange for tokens from non-prebuy acc", function() {
    return new Promise((resolve, reject) => {
        crowdsale.preBuy({
          from: web3.eth.accounts[7],
          value: web3.toWei(1, 'ether'),
          gas: 130000
        }).catch((err) => {
            assert.equal(err.message, 'VM Exception while processing transaction: invalid opcode')
            resolve()
        })
    })
  });

  function preBuyTest(vested, expected, eth, prebuyAddr) {
    return function() {
      var vestedPortion = vested;
      var totalExpected = expected;
      var preBuyEth = eth;
      var unvestedPortion = totalExpected-vestedPortion;

      var start
      return time.blockchainTime(web3)
      .then(function(_start) {
        start = _start

        return crowdsale.preBuy({
          from: prebuyAddr,
          value: web3.toWei(preBuyEth, 'ether'),
          gas: 260000
        })
      })
      .then(() => {          
        return crowdsale.balanceOf(prebuyAddr)
      })
      .then((res) => {
          assert.equal(totalExpected, res.toNumber())
          return crowdsale.transferableTokens(prebuyAddr, start)
      })
      .then(function(transferrable) {
          // 15295105 is vested portion at the hardcoded vested bonus
         assert.equal(unvestedPortion, transferrable.toNumber())
         return crowdsale.transferableTokens(prebuyAddr, start+90*24*60*60)
      }).then(function(transferrableBeforeCliff) {
          assert.equal(unvestedPortion, transferrableBeforeCliff.toNumber())
         return crowdsale.transferableTokens(prebuyAddr, start+91*24*60*60+1)
      }).then(function(transfrrableAfterCliff) {
          // 1/4 of the tokens should now be non-vested
          assert.equal(Math.floor(unvestedPortion+(91/365*vestedPortion)), transfrrableAfterCliff.toNumber())
      })
    };
  }
  it("pre-buy state: can pre-buy (addr1), vested tokens are properly vested", preBuyTest(15295105, 50750001, 3.030333, web3.eth.accounts[1]));
  it("pre-buy state: can pre-buy (addr2), vested tokens are properly vested", preBuyTest( 7577001, 50750001, 3.690000, web3.eth.accounts[2]));
  it("pre-buy state: can pre-buy (addr3), vested tokens are properly vested", preBuyTest( 3436058, 20616350, 1.468401, web3.eth.accounts[3]));

  it('Change time to crowdsale open', () => {
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

  it('Should allow to send ETH in exchange of Tokens', () => {
    const currentParticipiants = participiants.slice(0, 3)

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
            assert.equal(res.valueOf(), EXPECT_FOR_ONE_ETH);
            resolve()
          })

        })
      })
    }))
  })

  // tokens not transferrable

  it('Shouldnt allow to transfer tokens before end of crowdsale', () => {
    return crowdsale.transfer(web3.eth.accounts[4], 50, {
      from: web3.eth.accounts[5]
    }).then(() => {
      throw new Error('Cant be here')
    }).catch(err => {
      assert.equal(err.message, 'VM Exception while processing transaction: invalid opcode')
    }).then(() => {
      return Promise.join(
        crowdsale.balanceOf.call(web3.eth.accounts[4]),
        crowdsale.balanceOf.call(web3.eth.accounts[5]),
        (toBalance, fromBalance) => {
            assert.equal(toBalance.valueOf(), EXPECT_FOR_ONE_ETH)
            assert.equal(fromBalance.valueOf(), EXPECT_FOR_ONE_ETH)

        }
      )
    })
  })

  it('Change time to 40 days after crowdsale', () => {
    return new Promise((resolve, reject) => {
         web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [40*24*60*60],
          id: new Date().getTime()
        }, (err, result) => {
          err? reject(err) : resolve()
        })
    })
  })

  it("should track raised eth", function() {
    return crowdsale.etherRaised.call()
    .then(function(eth) {        
        assert.equal(eth.valueOf(), 10188734000000000000); // preBuy eth + 3 eth 
    })
  });

  // tokens transferable after end of crowdsale
  it('Should allow to transfer tokens after end of crowdsale', () => {
    return crowdsale.transfer(web3.eth.accounts[4], 50, {
      from: web3.eth.accounts[5]
    }).then(() => {
       return Promise.join(
        crowdsale.balanceOf.call(web3.eth.accounts[4]),
        crowdsale.balanceOf.call(web3.eth.accounts[5]),
        (toBalance, fromBalance) => {
            assert.equal(toBalance.valueOf(), EXPECT_FOR_ONE_ETH+50)
            assert.equal(fromBalance.valueOf(), EXPECT_FOR_ONE_ETH-50)
        }
      )
    })
  })

  // should allow for calling grantVested()
  var TEAM_TOKENS = 16000000 * 10000;

  it('call grantVested()', () => {
    var start;
    return crowdsale.grantVested(adexTeamAddr2, adexFundAddr, { from: ownerAddr })
   .then(function() { 
    return crowdsale.balanceOf(adexTeamAddr2)
   }).then(function(b) {
    assert.equal(b.toNumber(), TEAM_TOKENS)
   })
  })

  // vested tokens
  it('vesting schedule - check cliff & vesting afterwards (advances time)', () => {
    var recepient = web3.eth.accounts[6];

    var cliffDays = 92;
    var halfDays = 182.5;
    var totalDays = 365;
    var afterCliffAmount = Math.round(cliffDays/totalDays * TEAM_TOKENS); // 183 days worth of 10m tokens
    var halfAmount = Math.round(halfDays/totalDays * TEAM_TOKENS); // 365 days worth of 10m tokens

    return crowdsale.transfer(recepient, afterCliffAmount, { from: adexTeamAddr2 })
    .then(function() { throw new Error('should not be here - allowed to transfer - 1') })
    .catch(function(err) {
      assert.equal(err.message, 'VM Exception while processing transaction: invalid opcode')

      return time.move(web3, cliffDays*24*60*60)
    })
    .then(function() {
      return crowdsale.transfer(recepient, afterCliffAmount, { from: adexTeamAddr2 })
    }).then(function() {
      return crowdsale.balanceOf(recepient)
    }).then(function(b) {
      assert.equal(b.toNumber(), afterCliffAmount)

      return time.move(web3, (halfDays-cliffDays)*24*60*60)
    }).then(function() {
      // first make sure we can't get ahead of ourselves
      var amount = halfAmount-afterCliffAmount

      // try to get 10 more tokens initially
      return crowdsale.transfer(recepient, amount + 10*10000, { from: adexTeamAddr2 })
      .then(function() { 
        throw new Error('should not be here - allowed to transfer - 2') 
      })
      .catch(function(err) {        
        assert.equal(err.message, 'VM Exception while processing transaction: invalid opcode')
        return crowdsale.transfer(recepient, amount, { from: adexTeamAddr2 })
      })
    })
    .then(function() {
      return crowdsale.balanceOf(recepient)
    }).then(function(b) {
      assert.equal(b.toNumber(), halfAmount)
    });
  });
  /*
  it('Change time to 40 days after', () => {
    return new Promise((resolve, reject) => {
         web3.currentProvider.sendAsync({
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [40*24*60*60],
          id: new Date().getTime()
        }, (err, result) => {
          err? reject(err) : resolve()
        })
    })
  })
  */


});
