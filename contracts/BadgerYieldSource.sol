// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol"; 
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "./interfaces/pooltogether/IProtocolYieldSource.sol";
import "./interfaces/badger/IBadger.sol";
import "./access/AssetManager.sol";

/// @title An pooltogether yield source for Badger token
/// @author Sunny Radadiya
contract BadgerYieldSource is Initializable, ERC20Upgradeable, IProtocolYieldSource, ReentrancyGuardUpgradeable, AssetManager  {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    mapping(address => uint256) public balances;

    address public bBadger;
    address public underlyingAsset;
    uint256 public totalUnderlyingAssets;

    /// @notice Emitted when the yield source is initialized
    event BadgerYieldSourceInitialized(address indexed bBadger);

    /// @notice Emitted when asset tokens are redeemed from the yield source
    event RedeemedToken(
        address indexed from,
        uint256 shares,
        uint256 amount
    );

    /// @notice Emitted when asset tokens are supplied to the yield source
    event SuppliedTokenTo(
        address indexed from,
        uint256 shares,
        uint256 amount,
        address indexed to
    );

    /// @notice Emitted when asset tokens are supplied to sponsor the yield source
    event Sponsored(
        address indexed from,
        uint256 amount
    );

    /// @notice Emitted when ERC20 tokens other than yield source's aToken are withdrawn from the yield source
    event TransferredERC20(
        address indexed from,
        address indexed to,
        uint256 amount,
        address indexed token
    );

    /// @notice Initializes the yield source with Badger Token
    /// @param _bBadger Badger Token address
    function initialize(
        address _bBadger
    ) public initializer
     {
        __Ownable_init(); 
        bBadger = _bBadger;
        underlyingAsset = IBadger(bBadger).token();
        IERC20Upgradeable(underlyingAsset).safeApprove(bBadger, type(uint256).max);
        emit BadgerYieldSourceInitialized(bBadger);
    }

    /// @notice Returns the ERC20 asset token used for deposits.
    /// @return The ERC20 asset token
    function depositToken() external view override returns (address) {
        return (underlyingAsset);
    }

    /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
    /// @return The underlying balance of asset tokens
    function balanceOfToken(address addr) external view override returns (uint256) {
        if(balanceOf(addr) == 0) return 0;
        return _sharesToToken(balanceOf(addr));
    }

    /// @notice Calculates the balance of Total badger Tokens Contract hasv
    /// @return balance of bBadger Tokens
    function _totalShare() internal view returns(uint256) {
        return IBadger(bBadger).balanceOf(address(this));
    }

    /// @notice Calculates the number of shares that should be mint or burned when a user deposit or withdraw
    /// @param tokens Amount of tokens
    /// return Number of shares
    function _tokenToShares(uint256 tokens) internal view returns (uint256 shares) {
        uint256 _pool = IBadger(bBadger).balance();
        if (IBadger(bBadger).totalSupply() == 0) {   
            shares = tokens;
        } else {
            shares = (tokens * IBadger(bBadger).totalSupply()) / _pool;
        }
    }

    /// @notice Calculates the number of tokens a user has in the yield source
    /// @param shares Amount of shares
    /// return Number of tokens
    function _sharesToToken(uint256 shares) internal view returns (uint256 tokens) { 
        uint256 _pool = IBadger(bBadger).balance();
        if (IBadger(bBadger).totalSupply() == 0) {
            tokens = shares;
        } else {
            tokens = (shares * _pool / IBadger(bBadger).totalSupply());
        }
    }

    /// @notice Deposit asset tokens to Badger
    /// @param mintAmount The amount of asset tokens to be deposited 
    function _depositToBadger(uint256 mintAmount) internal returns (uint256) {
        uint256 previousBalance = IBadger(bBadger).balanceOf(address(this));
        IERC20Upgradeable(underlyingAsset).safeTransferFrom(msg.sender, address(this), mintAmount);
        IBadger(bBadger).deposit(mintAmount);
        uint256 currentBalance = IBadger(bBadger).balanceOf(address(this));
        return (currentBalance - previousBalance);
    }

    /// @notice Withdraws requested amount from Vault
    /// @param _badgerShare amount of share tokens to be redeemed
    /// @return Tokens received from the Vault
    function _withdrawFromVault(uint _badgerShare) internal returns (uint256) {
        uint256 previousBalance = IERC20Upgradeable(underlyingAsset).balanceOf(address(this));
        IBadger(bBadger).withdraw(_badgerShare);
        uint256 currentBalance = IERC20Upgradeable(underlyingAsset).balanceOf(address(this)); 
        return (currentBalance - previousBalance);
    }

    /// @notice Allows assets to be supplied on other user's behalf using the `to` param.
    /// @param mintAmount The amount of `token()` to be supplied
    /// @param to The user whose balance will receive the tokens
    function supplyTokenTo(uint256 mintAmount, address to) public nonReentrant override {
        uint256 _badgerShare = _tokenToShares(mintAmount);
        _depositToBadger(mintAmount);
        _mint(to, _badgerShare);
        emit SuppliedTokenTo(msg.sender, _badgerShare, mintAmount, to);
    }

    /// @notice Redeems tokens from the yield source from the msg.sender, it burn yield bearing tokens and return token to the sender.
    /// @param redeemAmount The amount of `token()` to withdraw.  Denominated in `token()` as above.
    /// @return The actual amount of tokens that were redeemed.
    function redeemToken(uint256 redeemAmount) public override nonReentrant returns (uint256) {
        uint256 _badgerShare = _tokenToShares(redeemAmount);
        _burn(msg.sender, _badgerShare);
        uint256 withdrawnAmount = _withdrawFromVault(_badgerShare);        
        IERC20Upgradeable(underlyingAsset).safeTransfer(msg.sender, withdrawnAmount);  
        emit RedeemedToken(msg.sender, _badgerShare, redeemAmount);
        return withdrawnAmount;
    }

    /// @notice Allows someone to deposit into the yield source without receiving any shares
    /// @dev This allows anyone to distribute tokens among the share holders
    /// @param amount The amount of tokens to deposit
    function sponsor(uint256 amount) external override {
        _depositToBadger(amount);
        emit Sponsored(msg.sender, amount);
    }

    /// @notice Transfer ERC20 tokens other than the bBadgerTokens held by this contract to the recipient address
    /// @dev This function is only callable by the owner or asset manager
    /// @param erc20Token The ERC20 token to transfer
    /// @param to The recipient of the tokens
    /// @param amount The amount of tokens to transfer
    function transferERC20(address erc20Token, address to, uint256 amount) external override onlyOwnerOrAssetManager {
        require(erc20Token != bBadger, "BadgerYieldSource/bBadger-transfer-not-allowed");
        IERC20Upgradeable(erc20Token).safeTransfer(to, amount);
        emit TransferredERC20(msg.sender, to, amount, erc20Token);
    }

    /// @notice Ratio between badgerShares and underlying token
    /// @dev use this to convert from shares to deposit tokens and viceversa
    /// @dev (see _tokenToYShares & _badgerSharesToToken)
    /// @return Price per vault's share
    function _pricePerBadgerShare() internal view returns (uint256) {
        return IBadger(bBadger).getPricePerFullShare();
    }
}
