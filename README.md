# CREATE3 Factory

Factory contract for easily deploying contracts to the same address on multiple chains, using CREATE3.

## Why?

Deploying a contract to multiple chains with the same address is annoying. One usually would create a new Ethereum account, seed it with enough tokens to pay for gas on every chain, and then deploy the contract naively. This relies on the fact that the new account's nonce is synced on all the chains, therefore resulting in the same contract address.
However, deployment is often a complex process that involves several transactions (e.g. for initialization), which means it's easy for nonces to fall out of sync and make it forever impossible to deploy the contract at the desired address.

One could use a `CREATE2` factory that deterministically deploys contracts to an address that's unrelated to the deployer's nonce, but the address is still related to the hash of the contract's creation code. This means if you wanted to use different constructor parameters on different chains, the deployed contracts will have different addresses.

A `CREATE3` factory offers the best solution: the address of the deployed contract is determined by only the deployer address and the salt. This makes it far easier to deploy contracts to multiple chains at the same addresses.

## Deployments

`CREATE3Factory` has been deployed to `0x3Ab34A5758F42080A536865aD3a7D35E92861418` on the following networks (see [`deployments/`](./deployments) for the full machine-readable list):

- Ethereum Mainnet
- Ethereum Sepolia Testnet
- Ethereum Holesky Testnet
- Arbitrum Mainnet
- Avalanche C-Chain Mainnet
- Base Mainnet
- Berachain Mainnet
- Blast Mainnet
- BSC Mainnet
- BSC Testnet
- Fraxtal Mainnet
- Fraxtal Testnet
- Hemi Mainnet
- Hemi Testnet
- Ink Mainnet
- Mantle Mainnet
- Morph Testnet
- Nibiru Mainnet
- Optimism Mainnet
- Plume Mainnet
- Polygon Mainnet
- Scroll Mainnet
- Taiko Mainnet

Every network above has the factory at the exact same address, because the address is a
deterministic function of the salt and the factory's bytecode, not of who deploys it — see
[Deploying to a new chain](#deploying-to-a-new-chain) below. This is a fork of
[zeframlou/create3-factory](https://github.com/zeframlou/create3-factory), which deploys its
own independent factory at `0x9fBB3DF7C40Da2e5A0dE984fFE2CCB7C47cd0ABf` on a separate set of
chains — the two addresses are unrelated to each other.

## Usage

Call `CREATE3Factory::deploy()` to deploy a contract and `CREATE3Factory::getDeployed()` to predict the deployment address, it's as simple as it gets.

A few notes:

- The salt provided is hashed together with the deployer address (i.e. msg.sender) to form the final salt, such that each deployer has its own namespace of deployed addresses.
- The deployed contract should be aware that `msg.sender` in the constructor will be the temporary proxy contract used by `CREATE3` rather than the deployer, so common patterns like `Ownable` should be modified to accomodate for this.

## Installation

To install with [Foundry](https://github.com/foundry-rs/foundry):

```
forge install zeframlou/create3-factory
```

## Local development

This project uses [Foundry](https://github.com/foundry-rs/foundry) as the development framework.

### Dependencies

```bash
forge install
```

### Compilation

```bash
forge build
```

### Deploying to a new chain

Anyone can deploy `CREATE3Factory` to a new chain and have it land at the same canonical
address (`0x3Ab34A5758F42080A536865aD3a7D35E92861418`) as every other chain listed above —
no shared or published private key is required, and you don't need permission from the
maintainers.

This works because the factory is deployed with a fixed salt via Solidity's salted `new`
(CREATE2), which Foundry routes through the
[canonical deterministic deployment proxy](https://github.com/Arachnid/deterministic-deployment-proxy)
(`0x4e59b44847b379578588920cA78FbF26c0B4956C`) — already live on most EVM chains. The
resulting address depends only on `(proxy address, salt, factory bytecode)`, **not** on who
sends the deployment transaction, so anyone deploying with their own wallet gets the exact
same address. `CREATE3Factory` itself has no owner or privileged functions (see
[`src/CREATE3Factory.sol`](./src/CREATE3Factory.sol)), so deploying it doesn't grant the
deployer any special control over it afterwards.

To deploy:

1. Add the chain's RPC URL to `foundry.toml` under `[rpc_endpoints]` and set `RPC_URL_...`
   (or the equivalent var) in `.env`.
2. Set `PRIVATE_KEY` in `.env` to your own wallet's key, funded with a small amount of the
   chain's native gas token. This key is only used to pay for your own deployment transaction
   — it is never shared or published.
3. Preview the address for free, with no gas spent and no key required:
   ```bash
   make predict network=<name>
   ```
   Confirm it prints `0x3Ab34A5758F42080A536865aD3a7D35E92861418`. If it doesn't, stop —
   see the caveat below before spending any gas.
4. Deploy for real:
   ```bash
   make deploy-with-key network=<name>
   ```
   This writes `deployments/<name>-<chainid>.json`, matching the existing files in
   [`deployments/`](./deployments). Re-running the same command on a chain that's already
   deployed is a no-op — it detects the existing contract and skips deployment instead of
   erroring. This target passes `--verify`, which submits source verification to the chain's
   block explorer using the matching key in `.env`; if you don't have one, drop `--verify`
   from the `deploy-with-key` recipe in the `Makefile` and verify later.

If the deterministic deployment proxy itself isn't yet live on your target chain (rare, only
on very new/obscure chains), `forge script --broadcast` deploys it automatically as part of
the same transaction sequence, at a small one-time extra cost (~0.007 ETH at the proxy's
fixed price of 100 gwei / 68,131 gas) — no extra steps needed on your part.

**Caveat:** the resulting address is only identical across chains if the contract is compiled
with the exact `solc` version, `evm_version`, and optimizer settings pinned in
`foundry.toml`. Building with different settings silently produces a different address — see
[`deployments/nibiru-6900-shanghai.json`](./deployments/nibiru-6900-shanghai.json), which was
built with a different `evm_version` and landed at a different address than every other
chain. Don't override the profile in `foundry.toml` when deploying.
