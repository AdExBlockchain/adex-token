#!/usr/bin/env bash

mkdir -p build-contract
./bundle.sh ./contracts/ADXToken.sol > ADXToken-bundled.sol
solcjs --optimize --bin -o build-contract ADXToken-bundled.sol
solcjs --optimize --abi -o build-contract ADXToken-bundled.sol
