// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./BadgerYieldSourceHarness.sol";
import "../interfaces/GenericProxyFactory/IGenericProxyFactory.sol";

contract BadgerYieldSourceProxyFactoryHarness {
    
    BadgerYieldSourceHarness public badgerYieldSourceInstance;
    IGenericProxyFactory public iGenericProxyFactory;
    
    constructor(address _bBadger, address _iGenericProxyFactory) {
        badgerYieldSourceInstance = new BadgerYieldSourceHarness(_bBadger);
        iGenericProxyFactory = IGenericProxyFactory(_iGenericProxyFactory);
    }
    
    function createNewProxy() 
        public returns (address instanceCreated, bytes memory result) {
            (instanceCreated, result)= iGenericProxyFactory.create(
                address(badgerYieldSourceInstance),
                ''
            );
    }
}