import { InjectedConnector } from "@starknet-react/core";
import { uint256 } from "starknet";
import BN from "bn.js";

import tokenArtifact from "./token.json";
import ethArtifact from "./eth.json";

export const E_18 = new BN("1000000000000000000");
export const ZERO = new BN("0");
export const MAX_UINT256 = new BN(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935"
);
export const ETH_ADDRESS =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

export const connectors = [
  //new InjectedConnector({ options: { id: 'braavos' }}),
  new InjectedConnector({ options: { id: "argentX" } }),
];

export const tokenContract = {
  address: "0x035aeae2de3c0193b3a1139c669254d357b02a747f01735adfa7a111096ff232",
  abi: tokenArtifact.abi,
};

export const ethContract = {
  address: ETH_ADDRESS,
  abi: ethArtifact.abi,
};

export function formatBN(bn) {
  const { div, mod } = bn.divmod(E_18);
  return `${div.toString()}.${mod.toString().replace(/0+$/, "")}`.replace(
    /\.$/,
    ""
  );
}

export function toUint256(n) {
  return uint256.bnToUint256(new BN(n));
}
