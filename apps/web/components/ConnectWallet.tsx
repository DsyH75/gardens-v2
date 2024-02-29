/* eslint-disable @next/next/no-img-element */
"use client";
import React from "react";
import { useBalance, useSwitchNetwork } from "wagmi";
import { usePathname } from "next/navigation";
import { getChain } from "@/configs/chainServer";
import Image from "next/image";
import { walletIcon } from "@/assets";
import {
  useAccountModal,
  useChainModal,
  ConnectButton,
} from "@rainbow-me/rainbowkit";
import { useDisconnect, useConnect } from "wagmi";
import cn from "classnames";
import { Button, EthAddress } from "@/components";
import { Fragment } from "react";

import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

export const ConnectWallet = () => {
  const path = usePathname();

  const urlChainId = Number(path.split("/")[2]);
  const tokenUrlAddress = path.split("/")[3];

  const { switchNetwork } = useSwitchNetwork();

  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();

  const wallet = connectors[0].name;

  const { data: token } = useBalance({
    address: "0x5BE8Bb8d7923879c3DDc9c551C5Aa85Ad0Fa4dE3",
    token: tokenUrlAddress as `0x${string}` | undefined,
    chainId: urlChainId || 0,
  });

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        return (
          <>
            {(() => {
              //CONNECT button to connect wallet
              if (!connected) {
                return (
                  <div className="relative flex text-black hover:brightness-90 active:scale-95">
                    <button
                      onClick={openConnectModal}
                      type="button"
                      className="border2 flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold uppercase transition-all ease-out hover:brightness-90 active:scale-95"
                    >
                      <Image
                        src={walletIcon}
                        alt="wallet"
                        height={26}
                        width={26}
                        className=""
                      />
                      Connect
                    </button>
                  </div>
                );
              }
              //WRONG NETWORK! button if wallet is connected to unsupported chains
              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="btn btn-error px-4 py-2 font-bold text-white"
                  >
                    Wrong network
                  </button>
                );
              }
              //IS CONNECTED to a supported chains with condition => urlChainId(urlChain) === chainId(wallet)
              return (
                <div
                  className={`relative flex w-fit cursor-pointer items-center gap-1 rounded-lg border-[1px] border-success px-2 py-1 ${cn(
                    {
                      "border-success ": urlChainId === chain.id,
                      "border-error":
                        urlChainId !== chain.id && !isNaN(urlChainId),
                    },
                  )} `}
                >
                  <img
                    alt={"Chain icon"}
                    src={`https://effigy.im/a/${account.address}.png`}
                    className="h-10 w-10 rounded-full"
                  />
                  <div className="flex flex-col">
                    <h4>{account.displayName}</h4>
                    <div className="flex items-center justify-end text-xs font-semibold text-success">
                      {isNaN(urlChainId) ? (
                        <>
                          <span>Connected to</span>
                          {chain.hasIcon && (
                            <div className="ml-1">
                              {chain.iconUrl && (
                                <Image
                                  alt={chain.name ?? "Chain icon"}
                                  src={chain.iconUrl}
                                  width={12}
                                  height={12}
                                />
                              )}
                            </div>
                          )}
                          <span>{chain.name}</span>
                        </>
                      ) : chain.id === urlChainId ? (
                        <>
                          {" "}
                          <span>Connected to</span>
                          {chain.hasIcon && (
                            <div className="ml-1">
                              {chain.iconUrl && (
                                <Image
                                  alt={chain.name ?? "Chain icon"}
                                  src={chain.iconUrl}
                                  width={12}
                                  height={12}
                                />
                              )}
                            </div>
                          )}{" "}
                          <span>{chain.name}</span>
                        </>
                      ) : (
                        <span className="text-error">Mismatch Network</span>
                      )}
                    </div>
                  </div>
                  <Menu as="div" className="inline-block text-left">
                    <div>
                      <Menu.Button>
                        <ChevronDownIcon
                          className="h-4 w-4 text-black "
                          aria-hidden="true"
                        />
                      </Menu.Button>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute left-0  top-0 z-10  mt-14 w-[270px] rounded-md bg-white focus:outline-none">
                        <div className="border2 flex flex-col gap-4 rounded-lg p-4">
                          {/* wallet and token balance info */}
                          <Menu.Item as="div" className="flex flex-col gap-2">
                            <div className="flex justify-between py-1">
                              <span className="stat-title">Wallet</span>{" "}
                              <span className="text-sm">{wallet}</span>
                            </div>
                            <div className="flex justify-between py-1">
                              <span className="stat-title">Balance</span>
                              <span className="text-sm">
                                {" "}
                                {!tokenUrlAddress
                                  ? "Unknow garden"
                                  : Number(token?.formatted).toFixed(0)}{" "}
                                {token?.symbol === "ETH" ? "" : token?.symbol}
                              </span>
                            </div>
                          </Menu.Item>

                          {/* Switch network and Disconnect buttons */}
                          <Menu.Item as="div" className="flex flex-col gap-2">
                            {chain.id !== urlChainId && !isNaN(urlChainId) && (
                              <Button
                                className="overflow-hidden truncate text-sm"
                                onClick={() =>
                                  switchNetwork && switchNetwork(urlChainId)
                                }
                              >
                                Switch to {getChain(urlChainId)?.name}
                              </Button>
                            )}

                            <Button
                              onClick={() => disconnect()}
                              variant="error"
                              className="text-sm"
                            >
                              Disconnect
                            </Button>
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              );
            })()}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
};
