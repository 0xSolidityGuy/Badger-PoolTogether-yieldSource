// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./BadgerYieldSource.sol";
import "./interfaces/GenericProxyFactory/IGenericProxyFactory.sol";

contract BadgerYieldSourceProxyFactory {
    
    BadgerYieldSource public iBadgerInstance;
    IGenericProxyFactory public iGenericProxyFactory;

    constructor(address _iGenericProxyFactory) {
        iBadgerInstance = new BadgerYieldSource();
        iGenericProxyFactory = IGenericProxyFactory(_iGenericProxyFactory);
    }
    
    function createNewProxy() 
        public returns (address instanceCreated, bytes memory result) {
            (instanceCreated, result)= iGenericProxyFactory.create(
                address(iBadgerInstance),
                ''
            );
    }
}