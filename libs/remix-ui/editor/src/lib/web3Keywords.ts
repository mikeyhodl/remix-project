export const WEB3_KEYWORDS = {
  "msg.sender": {
    title: "msg.sender",
    body: "The address of the account that directly called this function. Be careful — with delegatecall, msg.sender is preserved from the original caller, which can be exploited.",
    risk: "medium" as const,
    riskLabel: "Context-sensitive",
    docs: "https://docs.soliditylang.org/en/latest/units-and-global-variables.html#block-and-transaction-properties",
  },
  delegatecall: {
    title: "delegatecall",
    body: "Executes code from another contract in the current contract's storage context. Used in proxy patterns — but if the target is malicious or upgradeable without access control, it can overwrite your storage.",
    risk: "high" as const,
    riskLabel: "High risk",
    docs: "https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html#delegatecall-and-libraries",
  },
  selfdestruct: {
    title: "selfdestruct",
    body: "Destroys the contract and sends remaining ETH to a recipient. Deprecated since Cancun upgrade — SELFDESTRUCT no longer deletes code or storage in most cases. Avoid in new contracts.",
    risk: "high" as const,
    riskLabel: "Deprecated",
    docs: "https://eips.ethereum.org/EIPS/eip-6049",
  },
  "tx.origin": {
    title: "tx.origin",
    body: "The original externally-owned account that started the transaction chain. Never use for authentication — a malicious contract in the call chain can make tx.origin appear to be a trusted user.",
    risk: "high" as const,
    riskLabel: "Never use for auth",
    docs: "https://docs.soliditylang.org/en/latest/security-considerations.html#tx-origin",
  },
  assembly: {
    title: "assembly (Yul)",
    body: "Inline EVM assembly. Bypasses Solidity's safety checks entirely — you're operating directly on the stack and memory. Only use when absolutely necessary, and audit carefully.",
    risk: "high" as const,
    riskLabel: "Unsafe zone",
    docs: "https://docs.soliditylang.org/en/latest/assembly.html",
  },
  payable: {
    title: "payable",
    body: "Marks an address or function as able to receive Ether. A non-payable function will revert if ETH is sent. Make sure payable functions have withdrawal logic or the ETH may be locked forever.",
    risk: "low" as const,
    riskLabel: "Review logic",
    docs: "https://docs.soliditylang.org/en/latest/types.html#address",
  },
  unchecked: {
    title: "unchecked",
    body: "Disables Solidity's automatic overflow/underflow checks (added in 0.8.x). Saves gas, but you must manually verify that arithmetic cannot wrap around. Common in loop counters.",
    risk: "medium" as const,
    riskLabel: "Manual review needed",
    docs: "https://docs.soliditylang.org/en/latest/control-structures.html#checked-or-unchecked-arithmetic",
  },
  "block.timestamp": {
    title: "block.timestamp",
    body: "Unix timestamp of the current block, set by the miner/validator. Can be manipulated by ~15 seconds. Don't use for randomness or as a precise time lock in high-value contracts.",
    risk: "medium" as const,
    riskLabel: "Miner-influenced",
    docs: "https://docs.soliditylang.org/en/latest/units-and-global-variables.html#block-and-transaction-properties",
  },
  "msg.value": {
    title: "msg.value",
    body: "Amount of wei sent with the current function call. Only available in payable functions. Always check that your contract logic handles ETH correctly to prevent loss.",
    risk: "low" as const,
    riskLabel: "Handle carefully",
    docs: "https://docs.soliditylang.org/en/latest/units-and-global-variables.html#block-and-transaction-properties",
  },
  "block.number": {
    title: "block.number",
    body: "Current block number in the blockchain. More reliable than block.timestamp for timing, but can still be influenced by miners within certain bounds.",
    risk: "low" as const,
    riskLabel: "Generally safe",
    docs: "https://docs.soliditylang.org/en/latest/units-and-global-variables.html#block-and-transaction-properties",
  },
};

export const RISK_CONFIG = {
  high: { badge: "danger", icon: "fas fa-exclamation-triangle" },
  medium: { badge: "warning", icon: "fas fa-exclamation-circle" },
  low: { badge: "info", icon: "fas fa-info-circle" },
};

export type KeywordData = typeof WEB3_KEYWORDS[keyof typeof WEB3_KEYWORDS];
export type RiskLevel = keyof typeof RISK_CONFIG;