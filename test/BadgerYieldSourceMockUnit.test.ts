import {
	expect
} from 'chai';
import {
	deployMockContract
} from 'ethereum-waffle';
const {
	formatEther
} = require('@ethersproject/units')
import {
	ethers,
	waffle
} from 'hardhat'; 
import {
	BigNumber
} from '@ethersproject/bignumber';
import {
	JsonRpcProvider
} from '@ethersproject/providers';
import {
	SignerWithAddress
} from '@nomiclabs/hardhat-ethers/signers';

import IBadgerABI from "../artifacts/contracts/interfaces/badger/IBadger.sol/IBadger.json";
import SafeERC20WrapperUpgradeable from '../artifacts/contracts/test/SafeERC20WrapperUpgradeable.sol/SafeERC20WrapperUpgradeable.json';

import {
	BadgerYieldSourceHarness,
	IERC20Upgradeable as ERC20,
	IBadger,
	BadgerYieldSourceProxyFactoryHarness,
} from '../types';
const toWei = ethers.utils.parseEther;

describe('GenericProxyFactory', () => {

	let contractsOwner: SignerWithAddress;
	let yieldSourceOwner: SignerWithAddress;
	let wallet2: SignerWithAddress;
	let provider: JsonRpcProvider;
	let badgerYieldSource: any;
	let erc20Token: ERC20;
	let underlyingToken: any;
	let bBadgerToken: any;
	let maxValue: any

	beforeEach(async() => {
		[contractsOwner, yieldSourceOwner, wallet2] = await ethers.getSigners();
		maxValue = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
        provider = waffle.provider;

		erc20Token = ((await deployMockContract(
			contractsOwner,
			SafeERC20WrapperUpgradeable.abi,
		)) as unknown) as ERC20;

		underlyingToken = ((await deployMockContract(
			contractsOwner,
			SafeERC20WrapperUpgradeable.abi,
		)) as unknown) as ERC20;

		bBadgerToken = ((await deployMockContract(contractsOwner, IBadgerABI.abi)) as unknown) as IBadger;
		await bBadgerToken.mock.token.returns(underlyingToken.address);

		const genericProxyFactoryContract = await ethers.getContractFactory('GenericProxyFactory');
		const hardhatGenericProxyFactory = await genericProxyFactoryContract.deploy();

		const badgerYieldSourceProxyFactory = await ethers.getContractFactory(
			'BadgerYieldSourceProxyFactoryHarness'
		);
		const hardhatBadgerYieldSourceProxyFactory = (await badgerYieldSourceProxyFactory.deploy(
				bBadgerToken.address,
				hardhatGenericProxyFactory.address
			) as unknown) as BadgerYieldSourceProxyFactoryHarness;

		const initializeTx = await hardhatBadgerYieldSourceProxyFactory.createNewProxy();
		const receipt = await provider.getTransactionReceipt(initializeTx.hash);
		const proxyCreatedEvent = hardhatGenericProxyFactory.interface.parseLog(
			receipt.logs[0],
		);
		expect(proxyCreatedEvent.name).to.equal('ProxyCreated');

		badgerYieldSource = (await ethers.getContractAt(
			'BadgerYieldSourceHarness',
			proxyCreatedEvent.args[0],
			contractsOwner,
		) as unknown) as BadgerYieldSourceHarness;
	  	
		await underlyingToken.mock.allowance
			.withArgs(badgerYieldSource.address, bBadgerToken.address)
			.returns(toWei('0'));
		await underlyingToken.mock.approve.withArgs(bBadgerToken.address, maxValue).returns(true);
		await badgerYieldSource.initialize(bBadgerToken.address);
	});

	describe('create()', () => {
		it('should create BadgerYieldSource', async() => {
			const _bBadgerToken = await badgerYieldSource.bBadger();
			const _underlyingAsset = await badgerYieldSource.underlyingAsset();
			const _depositToken = await badgerYieldSource.depositToken();
			expect(_bBadgerToken).to.equal(bBadgerToken.address);
			expect(_underlyingAsset).to.equal(underlyingToken.address);
			expect(_depositToken).to.equal(underlyingToken.address);
		});
	});

	describe('depositToken()', () => {
		it('should return the underlying token', async() => {
			expect(await badgerYieldSource.depositToken()).to.equal(underlyingToken.address);
		});
	});

	describe('balanceOfToken()', () => {
		it('should return user balance', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			await badgerYieldSource.mint(wallet2.address, toWei('100'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('1500'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.balanceOfToken(wallet2.address)).to.equal(toWei('150'));
		});
	});

	describe('_tokenToShares()', () => {
		it('should return shares amount', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			await badgerYieldSource.mint(wallet2.address, toWei('100'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.tokenToShares(toWei('10'))).to.equal(toWei('5'));
		});

		it('should return 0 if tokens param is 0', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			await badgerYieldSource.mint(wallet2.address, toWei('100'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.tokenToShares(toWei('0'))).to.equal(toWei('0'));
		});

		it('should return tokens if totalSupply is 0', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('0'));
			await badgerYieldSource.mint(wallet2.address, toWei('0'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('0'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('0'));
			expect(await badgerYieldSource.tokenToShares(toWei('100'))).to.equal(toWei('100'));
		});

		it('should return shares even if badgerToken total supply has a lot of decimals', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('0.000000000000000005'));
			await badgerYieldSource.mint(wallet2.address, toWei('0.000000000000000005'));			
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.tokenToShares(toWei('0.000000000000000005'))).to.equal(toWei('0.000000000000000002'));
		});

		it('should return shares even if badgerToken total supply increases', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.tokenToShares(toWei('10'))).to.equal(toWei('5'));
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			expect(await badgerYieldSource.tokenToShares(toWei('10'))).to.equal(toWei('5'));
		});
	});

	describe('_sharesToToken()', () => {
		it('should return tokens amount', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			await badgerYieldSource.mint(wallet2.address, toWei('100'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.sharesToToken(toWei('20'))).to.equal(toWei('40'));
		});

		it('should return shares if totalSupply is 0', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('0'));
			await badgerYieldSource.mint(wallet2.address, toWei('0'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('0'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('0'));
			expect(await badgerYieldSource.sharesToToken(toWei('100'))).to.equal(toWei('100'));
		});

		it('should return tokens even if totalSupply has a lot of decimals', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('0.000000000000000005'));
			await badgerYieldSource.mint(wallet2.address, toWei('0.000000000000000005'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.sharesToToken(toWei('0.000000000000000005'))).to.equal(toWei('0.00000000000000001'));
		});

		it('should return tokens even if badgerToken total supply increases', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			expect(await badgerYieldSource.sharesToToken(toWei('100'))).to.equal(toWei('200'));
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			expect(await badgerYieldSource.sharesToToken(toWei('100'))).to.equal(toWei('200'));
		});
	});

	const supplyTokenTo = async(user: SignerWithAddress, userAmount: BigNumber) => {
		const userAddress = user.address;
		await underlyingToken.mock.balanceOf.withArgs(yieldSourceOwner.address).returns(toWei('200'));
		await bBadgerToken.mock.balanceOf.withArgs(badgerYieldSource.address).returns(toWei('300'));
		await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
		await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
		await underlyingToken.mock.transferFrom
			.withArgs(userAddress, badgerYieldSource.address, userAmount)
			.returns(true);
		await underlyingToken.mock.allowance
			.withArgs(badgerYieldSource.address, bBadgerToken.address)
			.returns(toWei('0'));
		await underlyingToken.mock.approve.withArgs(bBadgerToken.address, userAmount).returns(true);
		await bBadgerToken.mock.deposit
			.withArgs(userAmount)
			.returns();
		await badgerYieldSource.connect(user).supplyTokenTo(userAmount, userAddress);
	};

	describe('supplyTokenTo()', () => {
		let amount: BigNumber;

		beforeEach(async() => {
			amount = toWei('100');
		});

		it('should supply assets if totalSupply is 0', async() => {
			await supplyTokenTo(yieldSourceOwner, amount);
			expect(await badgerYieldSource.totalShare()).to.equal(toWei('300'));
		});

		it('should supply assets if totalSupply is not 0', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('100'));
			await badgerYieldSource.mint(wallet2.address, toWei('100'));
			await supplyTokenTo(yieldSourceOwner, amount);
		});

		it('should revert on error', async() => {
			await underlyingToken.mock.approve.withArgs(bBadgerToken.address, amount).returns(true);
			await bBadgerToken.mock.deposit
				.withArgs(amount)
				.returns();

			await expect(
				badgerYieldSource.supplyTokenTo(amount, badgerYieldSource.address),
			).to.be.revertedWith('');
		});
	});

	describe('redeemToken()', () => {
		let yieldSourceOwnerBalance: BigNumber;
		let redeemAmount: BigNumber;

		beforeEach(() => {
			yieldSourceOwnerBalance = toWei('300');
			redeemAmount = toWei('100');
		});

		it('should redeem assets', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, yieldSourceOwnerBalance);			
			await underlyingToken.mock.balanceOf.withArgs(badgerYieldSource.address).returns(toWei('300'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));

			await bBadgerToken.mock.withdraw
				.withArgs(toWei('50'))
				.returns();
			await underlyingToken.mock.transfer
				.withArgs(yieldSourceOwner.address,'0')
				.returns(true);

			await badgerYieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount);
			expect(await badgerYieldSource.balanceOf(yieldSourceOwner.address)).to.equal(
				toWei('250'),
			);
		});

		it('should not be able to redeem assets if balance is 0', async() => {
			await badgerYieldSource.mint(yieldSourceOwner.address, toWei('0'));
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			await underlyingToken.mock.transfer
				.withArgs(yieldSourceOwner.address, await badgerYieldSource.tokenToShares(toWei('0'))).returns(true);
			await expect(
				badgerYieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount)
			).to.be.reverted;
		});

		it('should fail to redeem if amount superior to balance', async() => {
			const yieldSourceOwnerLowBalance = toWei('10');
			await badgerYieldSource.mint(yieldSourceOwner.address, yieldSourceOwnerLowBalance);
			await bBadgerToken.mock.balance.withArgs().returns(toWei('2000'));
			await bBadgerToken.mock.totalSupply.withArgs().returns(toWei('1000'));
			await expect(
				badgerYieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount),
			).to.be.revertedWith('ERC20: burn amount exceeds balance');
		});
	});

	describe('sponsor()', () => {
		let amount: BigNumber;

		beforeEach(async() => {
			amount = toWei('300');
		});

		it('should sponsor Yield Source', async() => {
			const wallet2Amount = toWei('200');
			await badgerYieldSource.mint(wallet2.address, wallet2Amount);
			await bBadgerToken.mock.balanceOf.withArgs(badgerYieldSource.address).returns(toWei('300'));
	
			await underlyingToken.mock.transferFrom
				.withArgs(yieldSourceOwner.address, badgerYieldSource.address, amount)
				.returns(true);
			await underlyingToken.mock.allowance
				.withArgs(badgerYieldSource.address, bBadgerToken.address)
				.returns(toWei('0'));
			await underlyingToken.mock.approve.withArgs(bBadgerToken.address, amount).returns(true);
			await bBadgerToken.mock.deposit
				.withArgs(amount)
				.returns();
			await badgerYieldSource.connect(yieldSourceOwner).sponsor(amount);
		});

		it('should revert on error', async() => {
			await bBadgerToken.mock.balanceOf.withArgs(badgerYieldSource.address).returns(toWei('300'));
			await underlyingToken.mock.transferFrom
				.withArgs(yieldSourceOwner.address, badgerYieldSource.address, amount)
				.returns(true);
			await underlyingToken.mock.allowance
				.withArgs(badgerYieldSource.address, bBadgerToken.address)
				.returns(toWei('0'));
			await underlyingToken.mock.approve.withArgs(bBadgerToken.address, amount).returns(true);
			await bBadgerToken.mock.deposit
				.withArgs(amount)
				.reverts();
			await expect(badgerYieldSource.connect(yieldSourceOwner).sponsor(amount)).to.be.revertedWith('');
		});
	});

  describe('transferERC20()', () => {
    it('should transferERC20 if yieldSourceOwner', async () => {
      const transferAmount = toWei('10');
      await erc20Token.mock.transfer.withArgs(wallet2.address, transferAmount).returns(true);
      await badgerYieldSource
        .connect(contractsOwner)
        .transferERC20(erc20Token.address, wallet2.address, transferAmount);
    });

    it('should transferERC20 if assetManager', async () => {
      const transferAmount = toWei('10');
      await erc20Token.mock.transfer
        .withArgs(yieldSourceOwner.address, transferAmount)
        .returns(true);
      await badgerYieldSource.connect(contractsOwner).setAssetManager(wallet2.address);
      await badgerYieldSource
        .connect(wallet2)
        .transferERC20(erc20Token.address, yieldSourceOwner.address, transferAmount);
    });

    it('should not allow to transfer badgerToken', async () => {
      await expect(
        badgerYieldSource
          .connect(contractsOwner)
          .transferERC20(bBadgerToken.address, wallet2.address, toWei('10')),
      ).to.be.revertedWith('BadgerYieldSource/bBadger-transfer-not-allowed');
    });

    it('should fail to transferERC20 if not contractsOwner or assetManager', async () => {
      await expect(
        badgerYieldSource
          .connect(wallet2)
          .transferERC20(erc20Token.address, yieldSourceOwner.address, toWei('10')),
      ).to.be.revertedWith('OwnerOrAssetManager: caller is not owner or asset manager');
    });
  });
});
