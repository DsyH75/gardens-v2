"use client";
import { useEffect, useState } from "react";
import { Button, RegisterMember } from "@/components";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { PoolCard } from "@/components";
import { Address, useAccount } from "wagmi";
import { getCommunitiesByGardenQuery } from "#/subgraph/.graphclient";
import { formatAddress } from "@/utils/formatAddress";

type CommunityQuery = NonNullable<
  NonNullable<getCommunitiesByGardenQuery["tokenGarden"]>["communities"]
>[number];
type CommunityCardProps = CommunityQuery & { gardenToken: `0x${string}` };

export function CommunityCard({
  communityName: name,
  id: communityAddress,
  strategies,
  members,
  registerToken,
  registerStakeAmount,
}: CommunityQuery) {
  const [open, setOpen] = useState(false);
  const { address: accountAddress } = useAccount();
  // const [isMember, setIsMember] = useState<boolean>(false);

  // useEffect(() => {
  //   if (accountAddress && members) {
  //     const findMember = members.some(
  //       (m) => m.memberAddress == accountAddress.toLowerCase(),
  //     );
  //     setIsMember(findMember);
  //   } else {
  //     setIsMember(false);
  //   }
  // }, []);

  const pools = strategies ?? [];
  members = members ?? [];
  registerToken = registerToken ?? "0x0";
  registerStakeAmount = registerStakeAmount ?? 0;
  return (
    <div className="flex flex-col items-center justify-center gap-8 rounded-xl border-2 border-black bg-info p-8 transition-all duration-200 ease-in-out">
      <div className="relative flex w-full items-center justify-center">
        <p className="absolute left-0 top-[50%] m-0 translate-y-[-50%] font-bold">
          Community Pools: {pools.length}
        </p>
        <h3 className="m-0 font-press text-lg text-info-content">{name}</h3>
        <p className="absolute right-0 top-[50%] m-0 translate-y-[-50%] font-bold">
          {formatAddress(communityAddress)}
        </p>
      </div>
      <RegisterMember
        // isMember={isMember}
        communityAddress={communityAddress as Address}
        registerToken={registerToken as Address}
        registerStakeAmount={registerStakeAmount}
      />
      {/* pools */}
      <div
        className={`flex transform flex-wrap items-center justify-center gap-4 overflow-hidden p-4 transition-height duration-200 ease-in-out ${
          !open && "max-h-[290px]"
        } `}
      >
        {pools.map((pool, i) => (
          <PoolCard {...pool} key={i} />
        ))}
      </div>
      {pools.length > 2 && (
        <Button
          // style="outline"
          className="!rounded-full bg-white !p-3"
          onClick={() => setOpen((prev) => !prev)}
        >
          <ChevronDownIcon
            className={`block h-6 w-6 stroke-2 ${open && "rotate-180"}`}
            aria-hidden="true"
          />
        </Button>
      )}
    </div>
  );
}
