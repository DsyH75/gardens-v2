"use client";
import React, { useEffect, useState } from "react";
import {
  useContractReads,
  useContractWrite,
  useAccount,
  useChainId,
  useContractRead,
  Address,
} from "wagmi";
import { Button } from "./Button";
import { toast } from "react-toastify";
import useErrorDetails from "@/utils/getErrorName";
import {
  confirmationsRequired,
  getContractsAddrByChain,
} from "@/constants/contracts";
import { useViemClient } from "@/hooks/useViemClient";
import { erc20ABI, registryCommunityABI } from "@/src/generated";
import { abiWithErrors } from "@/utils/abiWithErrors";
import { getBuiltGraphSDK } from "#/subgraph/.graphclient";

export function RegisterMember({
  communityAddress,
  // isMember,
  registerToken,
  registerStakeAmount,
}: {
  communityAddress: Address;
  // isMember: boolean;
  registerToken: Address;
  registerStakeAmount: number;
}) {
  const { address } = useAccount();
  const viemClient = useViemClient();
  const chainId = useChainId();
  const contractsAddr = getContractsAddrByChain(chainId);

  // const [isMember, setIsMember] = useState();

  // const sdk = getBuiltGraphSDK();

  // const getIsMember = async () =>
  //   sdk.getMembers({
  //     me: address as `0x${string}`,
  //     comm: contractsAddresses?.registryCommunity as `0x${string}`,
  //   });

  const registryContractCallConfig = {
    address: communityAddress,
    abi: abiWithErrors(registryCommunityABI),
  };

  const {
    data: isMember,
    error,
    isSuccess,
  } = useContractRead({
    ...registryContractCallConfig,
    functionName: "isMember",
    args: [address || "0x"],
    watch: true,
  });

  const {
    data: registerMemberData,
    write: writeRegisterMember,
    error: errorRegisterMember,
    isSuccess: isSuccessRegisterMember,
  } = useContractWrite({
    ...registryContractCallConfig,
    functionName: "stakeAndRegisterMember",
  });

  const {
    data: unregisterMemberData,
    write: writeUnregisterMember,
    error: errorUnregisterMember,
    isSuccess: isSuccessUnregisterMember,
  } = useContractWrite({
    ...registryContractCallConfig,
    functionName: "unregisterMember",
  });

  const {
    data: allowTokenData,
    write: writeAllowToken,
    error: errorAllowToken,
    isSuccess: isSuccessAllowToken,
  } = useContractWrite({
    address: registerToken,
    abi: abiWithErrors(erc20ABI),
    args: [communityAddress, BigInt(registerStakeAmount)], // allowed spender address, amount
    functionName: "approve",
  });

  useErrorDetails(errorRegisterMember, "stakeAndRegisterMember");
  useErrorDetails(errorUnregisterMember, "unregisterMember");
  // useErrorDetails(errorMemberRegistered, "isMember");
  useErrorDetails(errorAllowToken, "approve");
  // useErrorDetails(errorGardenToken, "gardenToken");

  console.log(confirmationsRequired);

  const registerMemberTransactionReceipt = async () =>
    await viemClient.waitForTransactionReceipt({
      confirmations: confirmationsRequired,
      hash: isMember
        ? unregisterMemberData?.hash || "0x"
        : registerMemberData?.hash || "0x",
    });

  const allowTokenTransactionReceipt = async () =>
    await viemClient.waitForTransactionReceipt({
      confirmations: confirmationsRequired,
      hash: allowTokenData?.hash as `0x${string}`,
    });

  async function handleChange() {
    isMember ? writeUnregisterMember?.() : writeAllowToken?.();
  }

  useEffect(() => {
    if (isSuccessAllowToken) {
      writeRegisterMember?.();
    }
  }, [allowTokenData]);

  useEffect(() => {
    if (isSuccessRegisterMember || isSuccessUnregisterMember) {
      const receipt = registerMemberTransactionReceipt();
      toast
        .promise(receipt, {
          pending: "Transaction in progress",
          success: "Transaction Success",
          error: "Something went wrong",
        })
        .then((data) => {
          console.log(data);
          // getIsMember().then((data) => console.log(data.members.length));
          // console.log(isMember);
        })
        .catch((error: any) => {
          console.error(`Tx failure: ${error}`);
        });
    }
  }, [isSuccessRegisterMember, isSuccessUnregisterMember]);

  useEffect(() => {
    if (isSuccessAllowToken) {
      const receipt = allowTokenTransactionReceipt();
      toast
        .promise(receipt, {
          pending: "Transaction in progress",
          success: "Transaction Success",
          error: "Something went wrong",
        })
        .then((data) => {
          console.log(data);
        })
        .catch((error: any) => {
          console.error(`Tx failure: ${error}`);
        });
    }
  }, [isSuccessAllowToken]);

  if (isMember === undefined) return;
  return (
    <Button onClick={handleChange} className="w-fit bg-primary">
      {isMember ? "Leave community" : "Register in community"}
    </Button>
  );
}
