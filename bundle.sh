#!/usr/bin/env bash 

#echo $1 >&2
cat $1 | egrep "^import " | cut -d"\"" -f2 | cut -d"'" -f2 | while read line; do $0 "$(dirname $1)/$line"; done
cat $1 | egrep -v "^(pragma solidity |import )"
