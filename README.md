<p align="center">
  <a href="https://github.com/pooltogether/pooltogether--brand-assets">
    <img src="https://github.com/pooltogether/pooltogether--brand-assets/blob/977e03604c49c63314450b5d432fe57d34747c66/logo/pooltogether-logo--purple-gradient.png?raw=true" alt="PoolTogether Brand" style="max-width:100%;" width="200">
  </a>
</p>
<br />

# Badger Token YieldSource for PoolTogether Prize Pool

PoolTogether Yield Source that uses [Badger](https://badger.finance/) to generate yield by lending ERC20 token supported by Badger and deposited into the Badger Yield Source.

## Coveralls Test case badge as per pool together requirements  

![Tests](https://github.com/0xSolidityGuy/Badger-PoolTogether-yieldSource/actions/workflows/main.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/0xSolidityGuy/Badger-PoolTogether-yieldSource/badge.svg?branch=master)](https://coveralls.io/github/0xSolidityGuy/Badger-PoolTogether-yieldSource?branch=master)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)  

## KOVAN Testnet Deployed addresses

Badger YieldSource: 0x824EE918929E8560a8AdB5759802262deBD01D5e  
Sett:  0x7d51F51a1c00B52cf2128af411368b5ab1dE8E79  
Badger Token: 0x61822826853011Df15677BD2d9C3A66be8F2b048  
Controller:  0x6c1CC854DC552C3821C73828dB8E76b86daf4540  

## PoolTogether Smart contract Guidelines are followed

1). Used Solidity 0.8.4 so no need SafeMath library.  
2). Added reentrancy function to prevent from attacker.  
3). Logs are emitted.  
3). Badges are shown in Readme file for test cases using Coveralls.  
4). NatSpec added in solidity code.  
5). Code coverage is added you can check using `yarn coverage` command.  
5). Unit test using mock testing.  
6). Fork test also generated.  
7). deploy script is also there to deploy on kovan or mainnet.  

## GenericProxyFactory model used
Generic proxy factory model used as per the reference of pooltogethe. You can check here reference of Pooltogether-proxy-factory,  
https://github.com/pooltogether/pooltogether-proxy-factory/blob/master/contracts/GenericProxyFactory.sol

## Setup

1). Make `.env` file on root folder and add below variable with your config,  

    i). MNEMONIC='' 
    ii). INFURA_API_KEY=  
    iii). ALCHEMY_API_KEY=
    iv). FORK_ENABLED="false"

2). Install Dependency by 
    
    yarn 

3). To compile Smart contract code:
        
    yarn compile
 
3). To run unit tests:
        
    yarn test

4). Check test coverage

    yarn coverage

5). Test script for prizepool For Mainnet fork

    yarn fork

6). Deploy New Badger Yield Source through Pooltogether-proxy-contract on kovan or mainnet

    yarn deploy-kovan
    or
    yarn deploy-mainnet

