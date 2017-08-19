# adex-token
AdEx Token (ADX) contract

## The AdEx Token (ADX) is used by the AdEx Network for trading advertising space

This is the implementation of ADX, deployed at [this address](https://etherscan.io/address/0x4470BB87d77b963A013DB939BE332f927f2b992e)

ADX is an ERC20-compatible token built on OpenZeppelin's VestedToken


### Known issues (in production)

Those issues are deployed in production, but fixed in this repository.

* `totalSupply` is not defined, therefore 0; severity: minor, just missing meta

### Audit

This repository passed audit by NewAlchemy.io ; full report is published here: https://my.pcloud.com/publink/show?code=XZnkTiZ4R019ETo1WSkVqYbdp06KyvpQSoy
