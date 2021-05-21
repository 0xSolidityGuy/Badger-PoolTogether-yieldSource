pragma solidity 0.8.4;

interface IBadger {
  function deposit(uint256 _amount) external;
  function deposit(uint256 amount, bytes32[] calldata merkleProof) external;
  function withdraw(uint256 _amount) external;
  function withdrawAll() external;
  function token() external view returns(address);
  function decimals() external view returns(uint256);
  function balanceOf(address _account) external view returns(uint256);
  function getPricePerFullShare() external view returns(uint256); // for bBadger
  function pricePerShare() external view returns(uint256); // for wbtc
  function shareValue(uint256 numShares) external view returns(uint256); // for wbtc
  function balance() external view returns (uint256);
  function totalAssets() external view returns (uint256);
  function totalWrapperBalance(address) external view returns (uint256);
  function totalSupply() external view returns (uint256);
}