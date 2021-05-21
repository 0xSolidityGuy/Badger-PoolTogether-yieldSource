import chalk from 'chalk';

import { DeployResult } from 'hardhat-deploy/types';
import hre from "hardhat";

const displayLogs = !process.env.HIDE_DEPLOY_LOG;

function dim(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.dim(logMessage));
  }
}

function cyan(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.cyan(logMessage));
  }
}

function yellow(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.yellow(logMessage));
  }
}

function green(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.green(logMessage));
  }
}

function displayResult(name: string, result: DeployResult) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`);
  } else {
    green(`${name} deployed at ${result.address}`);
  }
}

const chainName = (chainId: number) => {
  switch (chainId) {
    case 1:
      return 'Mainnet';
    case 3:
      return 'Ropsten';
    case 4:
      return 'Rinkeby';
    case 5:
      return 'Goerli';
    case 42:
      return 'Kovan';
    case 77:
      return 'POA Sokol';
    case 99:
      return 'POA';
    case 100:
      return 'xDai';
    case 137:
      return 'Matic';
    case 31337:
      return 'HardhatEVM';
    case 80001:
      return 'Matic (Mumbai)';
    default:
      return 'Unknown';
  }
};

async function deployFunction() {
  const { getNamedAccounts, deployments, getChainId, ethers } = hre;
  const { deploy } = deployments;

  let { deployer, admin } = await getNamedAccounts();

  const chainId = parseInt(await getChainId());

  // 31337 is unit testing, 1337 is for coverage
  const isTestEnvironment = chainId === 31337 || chainId === 1337;

  const signer = ethers.provider.getSigner(deployer);

  dim('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  dim('PoolTogether Badger Yield Source - Deploy Script');
  dim('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  dim(`network: ${chainName(chainId)} (${isTestEnvironment ? 'local' : 'remote'})`);
  dim(`deployer: ${deployer}`);

  if (!admin) {
    admin = signer._address;
  }

  dim(`deployer: ${admin}`);

  cyan(`\nDeploying BadgerYieldSourceProxyFactory...`);

  let bBadgerSett;
  let genericProxyFactory;

  if (chainName(chainId) == 'Kovan') {
    // Kovan
    bBadgerSett = '0x7d51F51a1c00B52cf2128af411368b5ab1dE8E79'; // Kovan Badger Sett
    genericProxyFactory = '0x713edC7728C4F0BCc135D48fF96282444d77E604';

  } else { 
    // Mainnet
    bBadgerSett = '0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28'; // Mainnet Badger Sett
    genericProxyFactory = '0x594069c560D260F90C21Be25fD2C8684efbb5628';
  }

  let genericProxyFactory_instance = await ethers.getContractAt(
    'GenericProxyFactory',
    genericProxyFactory,
    signer,
  )

  const bBadgerYieldSourceProxyFactoryResult = await ethers.getContractFactory('BadgerYieldSourceProxyFactory');
  const bBadgerYieldSourceProxyFactoryResult_instance = await bBadgerYieldSourceProxyFactoryResult.deploy(genericProxyFactory)

  console.log("Deploying Proxy Yield Source...");

  let createProxyTx = await bBadgerYieldSourceProxyFactoryResult_instance.createNewProxy()
  const receipt = await ethers.provider.getTransactionReceipt(createProxyTx.hash);

  const proxyCreatedEvent = genericProxyFactory_instance.interface.parseLog(
    receipt.logs[0],
  );

  const proxyBadgerYieldSource = await ethers.getContractAt(
    'BadgerYieldSource',
    proxyCreatedEvent.args[0],
    signer,
  );
  console.log("Deployed Yield Source...");

  console.log("Initializing Yield Source");
  await proxyBadgerYieldSource.initialize(bBadgerSett);
  console.log("Initialized!!");

  console.log('Deployed New BadgerYieldSource Address', proxyBadgerYieldSource.address)
};

deployFunction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
