// read env variables
// const envPoolIdSignaling = process.env.POOL_ID_SIGNALING || "";
// const envStrat2Address = process.env.STRAT2_ADDR_ARB_SEPOLIA || "";
// const envTokenAddressArbSepolia = process.env.TOKEN_ADDR_ARB_SEPOLIA || "";
// const envTokenNativeAddressArbSepolia =
// process.env.TOKEN_NATIVE_ADDR_ARB_SEPOLIA || "";
const ENV = process.env.NEXT_PUBLIC_ENV_GARDENS || "";

const envAlloAddress = process.env.NEXT_PUBLIC_ALLO_ADDRESS_ARB_SEPOLIA || "";

const envPoolId = process.env.NEXT_PUBLIC_POOL_ID || 1;

const envStrat1Address = process.env.NEXT_PUBLIC_STRAT1_ADDR_ARB_SEPOLIA || "";

const envRegistryGardensAddArbSep =
  process.env.NEXT_PUBLIC_REGISTRY_GARDENS_ADDR_ARB_SEPOLIA || "";

const envAlloRegistryAddArbSep =
  process.env.NEXT_PUBLIC_ALLO_REGISTRY_ADDR_ARB_SEPOLIA || "";

const envPoolAdminAddressArbSepolia =
  process.env.NEXT_PUBLIC_POOL_ADMIN_ADDR_ARB_SEPOLIA || "";

const envCouncilSafeAddressArbSepolia =
  process.env.NEXT_PUBLIC_COUNCIL_SAFE_ADDR_ARB_SEPOLIA || "";

const envRpcUrlArbTestnet = process.env.NEXT_PUBLIC_RPC_URL_ARB_TESTNET || "";

let __contractsAddresses = {
  allo: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` as `0x${string}`,
  strategy: `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` as `0x${string}`,
  registryGardens:
    `0x61c36a8d610163660E21a8b7359e1Cac0C9133e1` as `0x${string}`,
  registry: `0x5FbDB2315678afecb367f032d93F642f64180aa3` as `0x${string}`,
  poolID: `1`,
  rpcUrl: `http://127.0.0.1:8545`,
};

if (ENV === "prod") {
  __contractsAddresses = {
    allo: `${envAlloAddress}` as `0x${string}`,
    strategy: `${envStrat1Address}` as `0x${string}`,
    registryGardens: `${envRegistryGardensAddArbSep}` as `0x${string}`,
    registry: `${envAlloRegistryAddArbSep}` as `0x${string}`,
    poolID: `${envPoolId}`,
    rpcUrl: `${envRpcUrlArbTestnet}`,
  };
}
console.log("env", ENV);
console.log("envs", __contractsAddresses);

export const contractsAddresses = __contractsAddresses;

export const isProd = ENV === "prod";
