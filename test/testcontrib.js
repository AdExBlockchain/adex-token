var ADXToken = artifacts.require("./ADXToken.sol");
var Promise = require('bluebird')

contract('ADXToken', function(accounts) {

  var crowdsale;
  var token;
  var deployed = ADXToken.deployed();

  var EXPECT_FOR_ONE_ETH = 11700000;

  var ownerAddr = web3.eth.accounts[0];
  var adexTeamAddr = web3.eth.accounts[9];
  var adexFundAddr = web3.eth.accounts[8];
  var prebuyAddr = web3.eth.accounts[1]; // one of the pre-buy addresses

  it("initialize contract", function() {
    var startDate = Math.floor(Date.now()/1000);

    return ADXToken.new(
      ownerAddr, // multisig
      adexTeamAddr, // team, whre 2% wings and 2% bounty will be received
      startDate+7*24*60*60, // public sale start
      startDate, // private sale start
      30800*1000000000000000000, // ETH hard cap, in wei
      web3.eth.accounts[1], 5047335,
      web3.eth.accounts[2], 5047335, // TODO: change accordingly
      web3.eth.accounts[3], 2340000 
    ).then(function(_crowdsale) {
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

  it("pre-buy state: can pre-buy, vested tokens are properly vested", function() {
    var start = Math.floor(Date.now()/1000);
    var vestedPortion = 15295105;
    var totalExpected = 50750001;
    var unvestedPortion = totalExpected-vestedPortion;
    return crowdsale.preBuy({
      from: prebuyAddr,
      value: web3.toWei(3.030333, 'ether'),
      gas: 260000
    }).then(() => {          
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
        assert.equal(Math.round(unvestedPortion+(91/365*vestedPortion)), transfrrableAfterCliff.toNumber())
    })
  });
  
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
    var participiants = web3.eth.accounts.slice(4, 8).map(account => {
      return {
        account: account,
        sent: web3.toWei(1, 'ether')
      }
    })

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


  // pre-sale

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
  it('call grantVested()', () => {
    var start;
    return crowdsale.grantVested(adexTeamAddr, adexFundAddr, { from: ownerAddr })
    .then(function() {
        start = Math.floor(Date.now()/1000);
    })
  })

  // vested tokens

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
