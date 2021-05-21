// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.4;

import "../BadgerYieldSource.sol";

/* solium-disable security/no-block-members */
contract BadgerYieldSourceHarness is BadgerYieldSource {

  constructor(address _bBadger) BadgerYieldSource() {
    bBadger = _bBadger;
    underlyingAsset = IBadger(bBadger).token();
  }

  function mint(address account, uint256 amount) public returns (bool) {
    _mint(account, amount);
    return true;
  }

  function totalShare() external view returns (uint256) {
      return _totalShare();
  }

  function tokenToShares(uint256 tokens) external view returns (uint256) {
      return _tokenToShares(tokens);
  }

  function sharesToToken(uint256 shares) external view returns (uint256) {
    return _sharesToToken(shares);
  }
}
