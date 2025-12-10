# Import Resolver URL Normalization

This document explains how external URLs and URIs are normalized and saved by the resolver, with examples of original → normalized mapping and expected save paths.

## npm CDNs (jsDelivr, unpkg)

- Versioned input
  - Original: https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol
  - Normalized mapping: @openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol
  - Saved under: .deps/npm/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol

- Unversioned input (resolved from workspace version)
  - Original: https://unpkg.com/@openzeppelin/contracts/token/ERC20/ERC20.sol
  - Normalized mapping: @openzeppelin/contracts/token/ERC20/ERC20.sol (version resolved via workspace)
  - Saved under: .deps/npm/@openzeppelin/contracts@<resolved>/token/ERC20/ERC20.sol

Notes
- The original → normalized mapping is recorded in the resolution index for IDE navigation.
- Unversioned requests are resolved according to version precedence (see Versioning doc).

## GitHub

- Blob URL → Raw conversion
  - Original: https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol
  - Rewritten to raw: https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts-upgradeable/v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol
  - Normalized mapping: github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol
  - Saved under: .deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol

- Unversioned refs
  - refs/heads/master is normalized to @master for deterministic saves

- Package metadata
  - When available, package.json is fetched at the same ref and saved under .deps/github/<org>/<repo>@<ref>/package.json to assist transitive resolution.

## IPFS

- Original: ipfs://QmHash/path/file.sol
- Normalized mapping: ipfs/QmHash/path/file.sol
- Saved under: .deps/ipfs/QmHash/path/file.sol

## Swarm

- Original: bzz-raw://abcdef/path/file.sol
- Normalized mapping: swarm/abcdef/path/file.sol
- Saved under: .deps/swarm/abcdef/path/file.sol

## npm alias prefix

- Original: npm:@openzeppelin/contracts@4.9.0/token/ERC20/ERC20.sol
- Normalized mapping: @openzeppelin/contracts@4.9.0/token/ERC20/ERC20.sol
- Saved under: .deps/npm/@openzeppelin/contracts@4.9.0/token/ERC20/ERC20.sol

## Resolution index

- File: .deps/npm/.resolution-index.json
- Structure: { "<targetFile>": { "<original>": "<normalized>" } }
- Purpose: Enables editor features (e.g., Go to Definition) to map from original import locations to saved content.
