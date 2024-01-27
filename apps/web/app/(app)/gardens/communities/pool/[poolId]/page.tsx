import { gardenLand } from "@/assets";
import { Proposals, Button } from "@/components";
import Image from "next/image";
import { cvStrategyAbi, alloAbi, registryGardensAbi } from "@/src/generated";
import { Abi, formatEther } from "viem";
import { contractsAddresses } from "@/constants/contracts";
import { ActivateMember } from "@/components";
import { createPublicClient, http } from 'viem'
import { localhost } from 'viem/chains'
 
const client = createPublicClient({
  chain: localhost, //@todo that run in server need be changed based in the URI {chain}
  transport: http()
});

//some metadata for each pool
const poolInfo = [
  {
    title: "Arbitrum Grants Conviction Voting Pool",
    description:
      "This Funding Pool uses conviction voting to distribute funds for the best public goods providers on our network. Stake your support in your favorite proposals below - the longer you stake, the more conviction your support grows. if a proposal reaches enough conviction to pass, funds will be distributed.",
  },
  {
    title: "1Hive Hackaton Signaling Pool",
    description:
      "Signaling pool for the 1hive Platform. Which most commonly used to signal support for a proposal or idea. The funds in this pool are not used for funding proposals, but rather to signal support for proposals in other pools.",
  },
];

type PoolData = {
  profileId: `0x${string}`;
  strategy: `0x${string}`;
  token: `0x${string}`;
  metadata: { protocol: bigint; pointer: string };
  managerRole: `0x${string}`;
  adminRole: `0x${string}`;
};

export default async function Pool({
  params: { poolId },
}: {
  params: { poolId: number };
}) {

const poolData = await client.readContract({
  abi: alloAbi,
  address: contractsAddresses.allo,
  functionName: 'getPool',
  args: [BigInt(poolId)]
}) as PoolData;

  // const poolData = (await readContract(wagmiConfig,{
  //   address: contractsAddresses.allo,
  //   abi: alloAbi as Abi,
  //   functionName: "getPool",
  //   args: [BigInt(poolId)],
  // })) as PoolData;

  // console.log(poolData, {
  //   address: poolData?.strategy,
  //   abi: cvStrategyAbi,
  //   functionName: "getPoolAmount",
  // });

  //get the Pool Balance
  // const poolBalance = await readContract(wagmiConfig,{
  //   address: poolData.strategy,
  //   abi: cvStrategyAbi,
  //   functionName: "getPoolAmount",
  // });

  const poolBalance = await client.readContract({
    address: poolData.strategy,
    abi: cvStrategyAbi,
    functionName: "getPoolAmount",
  });


  const parsedPoolBalance = Number(poolBalance);

  return (
    <div className="relative mx-auto flex max-w-7xl gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-1 flex-col gap-6 rounded-xl border-2 border-black bg-surface p-16">
        <header className="flex flex-col items-center justify-center">
          <h2 className="text-center font-press">Pool {poolId} </h2>
          <h4 className="text-2xl ">
            {poolInfo[(poolId as unknown as number) - 1].title}
          </h4>
        </header>
        <main className="flex flex-col gap-10">
          {/* header: description - data - bottom land image */}
          <section className="relative flex w-full flex-col items-center overflow-hidden rounded-lg border-2 border-black bg-white">
            <div className="mt-4 flex flex-col gap-12 p-8">
              <p className="max-w-4xl text-center text-lg font-semibold">
                {/* {poolInfo[(poolId as unknown as number) - 1].description} */}
              </p>
              <div className="flex w-full p-4">
                <div className="flex flex-1 flex-col space-y-4 text-xl font-semibold">
                  {/* {poolId === contractsAddresses.poolID && (
                    <>
                      {status === "pending" ? (
                        <>
                          <div className="flex flex-col items-center justify-center">
                            <p>fetching balance ..</p>{" "}
                            <span className="loading loading-spinner loading-lg"></span>
                          </div>
                        </>
                      ) : (
                        <> */}
                  <div className="flex flex-col items-center justify-center">
                    <div>
                      <h3 className="font-press text-xl transition-all duration-150 ease-in ">
                        Funds Available:{" "}
                      </h3>
                    </div>

                    {parsedPoolBalance && (
                      <h4 className="font-press">{parsedPoolBalance} $ALLO</h4>
                    )}
                  </div>
                  {/* </>
                      )}
                    </>
                  )} */}
                  {/* <span>Strategy type: Conviction Voting</span>
                  <span>Funding Token: Honey</span> */}
                </div>
                <div className="flex flex-1 flex-col items-center space-y-4 font-bold">
                  <span>Proposals type accepted:</span>
                  <div className="flex w-full items-center justify-evenly">
                    <span className="badge w-28 bg-primary p-4 tracking-wide">
                      Funding
                    </span>
                    <span className="badge w-28 bg-secondary p-4 opacity-30">
                      Streaming
                    </span>
                    <span className="badge w-28 bg-accent p-4 opacity-40">
                      Signaling
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <ActivateMember strategyAddress={poolData.strategy} />
              </div>
            </div>
            <div className=" flex">
              {[...Array(6)].map((_, i) => (
                <Image
                  key={i}
                  src={gardenLand}
                  alt="garden land"
                  className=""
                />
              ))}
            </div>
          </section>
          <Proposals poolId={poolId} strategyAddress={poolData.strategy} />
        </main>
      </div>
    </div>
  );
}
