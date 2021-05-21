import hre from "hardhat";
import { task } from 'hardhat/config';

import PoolWithMultipleWinnersBuilder from '@pooltogether/pooltogether-contracts/deployments/mainnet/PoolWithMultipleWinnersBuilder.json';
import RNGBlockhash from '@pooltogether/pooltogether-rng-contracts/deployments/mainnet/RNGBlockhash.json';
import ControlledToken from '@pooltogether/pooltogether-contracts/abis/ControlledToken.json';
import MultipleWinners from '@pooltogether/pooltogether-contracts/abis/MultipleWinners.json';
import YieldSourcePrizePool from '@pooltogether/pooltogether-contracts/abis/YieldSourcePrizePool.json';

import { dai, usdc } from '@studydefi/money-legos/erc20';
import { info, success } from './helpers';
import IYieldSourceAbi from '../abis/IYieldSource.json';
import daiAbi from '../abis/daiAbi.json';
import { BigNumber } from "ethers";
const BadgerSettAbi = require('../abis/BadgerSett.json');

async function main() {
  const ethers = hre.ethers
  let accounts = await ethers.getSigners();

  const accountToImpersonate = '0xB65cef03b9B89f99517643226d76e286ee999e77'
  const badgerAddress = '0x3472A5A71965499acd81997a54BBA8D852C6E53d' // Badger ERC20 Token address
  const bBadgerToken = '0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28' // Badger Sett Badger

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [accountToImpersonate]
  })
  let signer = await ethers.provider.getSigner(accountToImpersonate)

//   await hre.network.provider.request({
//     method: "hardhat_impersonateAccount",
//     params: ['0xB65cef03b9B89f99517643226d76e286ee999e77']
// })

  signer = await hre.ethers.provider.getSigner(accountToImpersonate)
  let badgerSettContract = new hre.ethers.Contract(bBadgerToken, BadgerSettAbi, signer)

  const { constants, provider, getContractAt, getContractFactory, getSigners, utils } = ethers;
  const [contractsOwner] = await getSigners();
  // console.log('contractsOwner-----', contractsOwner.address, accounts[0].address);
  const { AddressZero } = constants;
  const { getBlock, getBlockNumber, getTransactionReceipt, send } = provider;

  let daiContract = await getContractAt(dai.abi, badgerAddress, signer);
  // await daiContract.transfer(accounts[0].address, daiContract.balanceOf(accountToImpersonate))
  // signer = await ethers.provider.getSigner(accounts[0].address)
  // daiContract = new ethers.Contract(badgerAddress, dai.abi, signer)

  info('Deploying BadgerYieldSource...');
  
  let BadgerYieldSource = await ethers.getContractFactory('BadgerYieldSource', signer);
  let BadgerYieldSource_Instance = await BadgerYieldSource.deploy();

  let genericProxyFactoryContract = await ethers.getContractFactory('GenericProxyFactory');
  let hardhatGenericProxyFactory = await genericProxyFactoryContract.deploy()
  
  let hardhatBadgerYieldSourceProxyFactory = await ethers.getContractFactory('BadgerYieldSourceProxyFactory', signer);
  let hardhatBadgerYieldSourceProxyFactory_Instance = await hardhatBadgerYieldSourceProxyFactory.deploy(hardhatGenericProxyFactory.address);

  let createProxyTx = await hardhatBadgerYieldSourceProxyFactory_Instance.createNewProxy()
  const receipt = await provider.getTransactionReceipt(createProxyTx.hash);

  const proxyCreatedEvent = hardhatGenericProxyFactory.interface.parseLog(
    receipt.logs[0],
  );

  const proxyBadgerYieldSource = await getContractAt(
    IYieldSourceAbi,
    proxyCreatedEvent.args[0],
    signer,
  );

  console.log('signer.address', signer._address)
  await badgerSettContract.connect(signer).approveContractAccess(proxyCreatedEvent.args[0])

  await proxyBadgerYieldSource.initialize(bBadgerToken)
  // const owner2 = await proxyBadgerYieldSource.owner();
  // await proxyBadgerYieldSource.setAssetManager(accounts[1].address);

  info('Deploying BadgerYieldSourcePrizePool...');

  const poolBuilder = await getContractAt(
    PoolWithMultipleWinnersBuilder.abi,
    PoolWithMultipleWinnersBuilder.address,
    signer,
  );

  const BadgerYieldSourcePrizePoolConfig = {
    yieldSource: proxyCreatedEvent.args[0],
    maxExitFeeMantissa: ethers.utils.parseUnits('0.5', 18),
    maxTimelockDuration: 1000,
  };

  const block = await getBlock(await getBlockNumber());
  const multipleWinnersConfig = {
    rngService: RNGBlockhash.address,
    prizePeriodStart: block.timestamp,
    prizePeriodSeconds: 60,
    ticketName: 'Ticket',
    ticketSymbol: 'TICK',
    sponsorshipName: 'Sponsorship',
    sponsorshipSymbol: 'SPON',
    ticketCreditLimitMantissa: ethers.utils.parseEther('0.1'),
    ticketCreditRateMantissa: ethers.utils.parseEther('0.001'),
    numberOfWinners: 1,
  };

  const yieldSourceMultipleWinnersTx = await poolBuilder.createYieldSourceMultipleWinners(
    BadgerYieldSourcePrizePoolConfig,
    multipleWinnersConfig,
    18,
  );

  const yieldSourceMultipleWinnersReceipt = await getTransactionReceipt(
    yieldSourceMultipleWinnersTx.hash,
  );

  const yieldSourcePrizePoolInitializedEvent = yieldSourceMultipleWinnersReceipt.logs.map(
    (log) => {
      try {
        return poolBuilder.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    },
  );

  const prizePool = await getContractAt(
    YieldSourcePrizePool,
    yieldSourcePrizePoolInitializedEvent[yieldSourcePrizePoolInitializedEvent.length - 1]?.args[
      'prizePool'
    ],
    signer,
  );
  success(`Deployed BadgerYieldSourcePrizePool! ${prizePool.address}`);

  const prizeStrategy = await getContractAt(
    MultipleWinners,
    await prizePool.prizeStrategy(),
    signer,
  );
  await prizeStrategy.connect(signer).addExternalErc20Award(badgerAddress);

  const daiAmount = ethers.utils.parseUnits('100', 18);
  await daiContract.connect(signer).approve(prizePool.address, daiAmount);

  info(`Depositing ${ethers.utils.formatUnits(daiAmount, 18)} DAI...`);

  await prizePool.connect(signer).depositTo(
    accountToImpersonate,
    daiAmount,
    await prizeStrategy.ticket(),
    AddressZero,
  );

  success('Deposited DAI!');
  
  info(`Prize strategy owner: ${await prizeStrategy.owner()}`);

  // // simulating returns in the vault during the prizePeriod
  const daiProfits = ethers.utils.parseUnits('100', 18);
  info(`yVault generated ${ethers.utils.formatUnits(daiProfits, 18)} DAI`);

  await send('evm_increaseTime', [10000]);
  await send('evm_mine', []);

  info('Starting award...');
  await prizeStrategy.startAward();

  await send('evm_increaseTime', [100000]);
  await send('evm_mine', []);

  info('Completing award...');
  const awardTx = await prizeStrategy.connect(signer).completeAward();
  const awardReceipt = await getTransactionReceipt(awardTx.hash);
  const awardLogs = awardReceipt.logs.map(log => { 
    try 
      { return prizePool.interface.parseLog(log) } 
    catch (e) 
    { return null }
  })
  const awarded = awardLogs.find(event => event && event.name === 'Awarded')
  if (awarded) {
    console.log(`Awarded ${ethers.utils.formatUnits(awarded.args.amount, 18)} token`)      
  } else {
    console.log(`No prizes`)
  }

  info('Withdrawing...');
  const ticketAddress = await prizeStrategy.connect(signer).ticket();

  const ticket = await getContractAt(ControlledToken, ticketAddress, signer);
  const withdrawalAmount = ethers.utils.parseUnits('100', 18);
  const earlyExitFee = await prizePool.callStatic.calculateEarlyExitFee(accountToImpersonate, ticket.address, withdrawalAmount);

  const ticketContract = await getContractAt(daiAbi, ticket.address, signer);
  const ticketBal0 = await ticketContract.balanceOf(accountToImpersonate)
  console.log('Ticket Balance and Exit Fee', ticketBal0.toString(), earlyExitFee.exitFee.toString())

  const withdrawAmt = BigNumber.from(ticketBal0.toString())
                        .sub(BigNumber.from(earlyExitFee.exitFee.toString()))
  console.log('WithdrawAmt', withdrawAmt.toString())

  await send('evm_increaseTime', [100000]);
  await send('evm_mine', []);

  const withdrawTx = await prizePool.connect(signer).withdrawInstantlyFrom(
    accountToImpersonate,
    '100000',
    ticket.address,
    earlyExitFee.exitFee,
  );

  const withdrawReceipt = await getTransactionReceipt(withdrawTx.hash);
  // console.log('withdrawReceipt', withdrawReceipt.toString())

  const withdrawLogs = withdrawReceipt.logs.map((log) => {
    try {
      return prizePool.interface.parseLog(log);
    } catch (e) {
      return null;
    }
  });

  const withdrawn = withdrawLogs.find((event) => event && event.name === 'InstantWithdrawal');
  success(`Withdrawn ${ethers.utils.formatUnits(withdrawn?.args?.redeemed, 18)} DAI!`);
  success(`Exit fee was ${ethers.utils.formatUnits(withdrawn?.args?.exitFee, 18)} DAI`);

  const prizePoolBalance = await proxyBadgerYieldSource.balanceOfToken(prizePool.address)
  console.log('prizePoolBalance After Withdraw', prizePoolBalance.toString())

  const ticketBal1 = await ticketContract.balanceOf(accountToImpersonate)
  console.log('Ticket Balance After Withdraw', ticketBal1.toString())

  await prizePool.captureAwardBalance();
  const awardBalance = await prizePool.callStatic.awardBalance();
  console.log('awardBalance', awardBalance.toString())

  success(`Current awardable balance is ${ethers.utils.formatUnits(awardBalance, 18)} DAI`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});
