"use client";
import React, { useEffect, useState, ChangeEvent } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { FormModal } from "./FormModal";
import { registryFactoryABI } from "@/src/generated";
import { parseUnits } from "viem";
import { usePrepareContractWrite, useContractWrite } from "wagmi";
import { abiWithErrors } from "@/utils/abiWithErrors";
import { Button } from "@/components";
import { ipfsFileUpload, ipfsJsonUpload } from "@/utils/ipfsUpload";
import { toast } from "react-toastify";
import { PhotoIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

//docs link: https://react-hook-form.com/

//protocol : 1 => means ipfs!, to do some checks later

type FormInputs = {
  name: string;
  stake: number;
  isKickMemberEnabled: boolean;
  feeReceiver: string;
  feeAmount: number;
  councilSafe: string;
  ipfsHash: string;
};

type PreviewDataProps = {
  [x: string]: {
    name: string;
    stake: number;
    isKickMemberEnabled: boolean;
    feeReceiver: string;
    feeAmount: string;
    councilSafe: string;
    covenant: string;
    file: any;
  };
};
const ethereumAddressRegExp = /^(0x)?[0-9a-fA-F]{40}$/;

export const CommunityForm = ({ tokenGarden }: { tokenGarden: any }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitted },
    getValues,
    setValue,
    reset,
    watch,
  } = useForm<FormInputs>();

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  // TODO: add types
  const [previewData, setPreviewData] = useState<any>(null); // preview data
  const [file, setFile] = useState<File>(); //banner image
  const [fileHashIpfs, setFileHastIpfs] = useState<string>(); // image(ipfs) hash
  const [covenant, setCovenant] = useState<string>();
  const [metadataIpfs, setMetadataIpfs] = useState<string>(); // ipfs hash to get fileHashIpfs + covenant description
  const [formData, setFormData] = useState(undefined) as any; // args for contract write

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFile = e.target.files[0];

    const ipfsUpload = ipfsFileUpload(selectedFile);

    toast
      .promise(ipfsUpload, {
        pending: "Uploading image...",
        success: "Successfully uploaded!",
        error: "Try uploading banner image again",
      })
      .then((data) => {
        console.log("https://ipfs.io/ipfs/" + data);
        setFile(selectedFile);
        setFileHastIpfs(data);
      })
      .catch((error: any) => {
        console.error(error);
      });
  };

  const handleJsonUpload = () => {
    const sampleJson = {
      imagen: fileHashIpfs,
      descripcion: covenant,
    };

    if (!file) {
      alert("please attach a banner image");
      return;
    }

    const ipfsUpload = ipfsJsonUpload(sampleJson);

    toast
      .promise(ipfsUpload, {
        pending: "Uploading to IPFS...",
        success: "Successfully uploaded!",
        error: "Something went wrong",
      })
      .then((data) => {
        console.log("https://ipfs.io/ipfs/" + data);
        setMetadataIpfs(data);
      })
      .catch((error: any) => {
        console.error(error);
      });
  };

  const handlePreview = () => {
    if (!file) {
      alert("please attach an image");
      return;
    }

    handleJsonUpload();

    const data = {
      name: getValues("name"),
      stake: getValues("stake"),
      isKickMemberEnabled: getValues("isKickMemberEnabled"),
      feeAmount: getValues("feeAmount"),
      feeReceiver: getValues("feeReceiver"),
      councilSafe: getValues("councilSafe"),
      covenant,
      file,
    };

    setPreviewData(data);
    setIsEditMode(true);
  };

  const { config } = usePrepareContractWrite({
    //TODO: add dynamic address
    //contract for localhost deploy
    address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    //contract for arb sepolia
    // address: "0xfbe59fe1a2630311c98b3f3a917bab764397a72b",
    abi: abiWithErrors(registryFactoryABI),
    functionName: "createRegistry",
    args: [formData],
  });

  const { write, error, isError, data } = useContractWrite(config);

  const handleInputData = (data: any) => {
    if (!data) {
      console.log("data not provided");
    }

    if (!metadataIpfs) {
      console.log("not metadata provided");
    }

    const decimals = 18;

    //TODO: add dynamic contract addresses
    //contract for localhost deploy:
    const alloContractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    //contract for arb sepolia:
    //const alloContractAddress = "0x1133ea7af70876e64665ecd07c0a0476d09465a1";
    const gardenTokenAddress = tokenGarden?.id;
    const communityName = data?.name;
    const stakeAmount = parseUnits(data?.stake, decimals);
    const protocolFeeAmount = parseUnits(data?.feeAmount, decimals);
    const protocolFeeReceiver =
      data?.feeReceiver || "0x0000000000000000000000000000000000000000";
    const councilSafeAddress =
      data?.councilSafe || "0xc05301902A91DcA455Bff2B9beBeE28A4830E3EC";
    const metadata = [1n, metadataIpfs];
    const isKickMemberEnabled = data?.isKickMemberEnabled;
    const ipfsHash = "";

    setFormData([
      alloContractAddress,
      gardenTokenAddress,
      stakeAmount,
      protocolFeeAmount,
      0n,
      "0x0000000000000000000000000000000000000000",
      protocolFeeReceiver,
      metadata,
      councilSafeAddress,
      communityName,
      isKickMemberEnabled,
      ipfsHash,
    ]);
  };

  //TODO: hanldle this with lucho
  const handleCreateNewCommunity: SubmitHandler<FormInputs> = (data: any) => {
    try {
      handleInputData(data);

      console.log(formData);
      // write?.();
    } catch (error) {
      console.error("An error occurred:", error);
    }
  };

  useEffect(() => {
    if (!isSubmitting && isSubmitted) {
      write?.();
    }
  }, [isSubmitting, isSubmitted]);

  const isKickMemberEnabled = watch("isKickMemberEnabled");
  const inputClassname = "input input-bordered input-info w-full max-w-md";
  const labelClassname = "mb-2 text-xs text-secondary";

  return (
    <>
      <FormModal
        label="Create Community"
        title={`Welcome to the ${tokenGarden?.symbol} Community Form!`}
        description={`Create a vibrant community around the ${tokenGarden.name} by
        providing the necessary details below.`}
      >
        <form onSubmit={handleSubmit(handleCreateNewCommunity)}>
          {!isEditMode ? (
            <div className="flex flex-col space-y-6 overflow-hidden px-1">
              <div className="flex flex-col">
                <label htmlFor="Community Name" className={labelClassname}>
                  Community Name
                </label>
                <input
                  type="text"
                  placeholder="1hive"
                  className={inputClassname}
                  {...register("name", {
                    required: true,
                  })}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="stake" className={labelClassname}>
                  {`Membership Stake Amount ( ${tokenGarden.symbol} tokens )`}
                </label>
                <input
                  type="number"
                  placeholder=""
                  className={inputClassname}
                  {...register("stake", {
                    required: true,
                  })}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="feeAmount" className={labelClassname}>
                  Protocol fee %
                </label>
                <select
                  className="select select-accent w-full max-w-md"
                  {...register("feeAmount", { required: true })}
                >
                  <option value={0}>0%</option>
                  <option value={1}>1%</option>
                  <option value={2}>2%</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label htmlFor="feeReceiver" className={labelClassname}>
                  Protocol fee Receiver address
                </label>
                <input
                  type="text"
                  placeholder="0x.."
                  className={inputClassname}
                  {...register("feeReceiver", {
                    required: true,
                    pattern: {
                      value: ethereumAddressRegExp,
                      message: "Invalid Eth Address",
                    },
                  })}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="councilSafe" className={labelClassname}>
                  Council safe address
                </label>
                <input
                  type="text"
                  placeholder="0x.."
                  className={inputClassname}
                  {...register("councilSafe", {
                    required: true,
                    pattern: {
                      value: ethereumAddressRegExp,
                      message: "Invalid Eth Address",
                    },
                  })}
                />
              </div>

              <div className="mb-4 flex items-center">
                <input
                  defaultChecked
                  id="checkbox-1"
                  type="checkbox"
                  value=""
                  {...register("isKickMemberEnabled")}
                  className="checkbox-accent checkbox"
                />
                <label
                  htmlFor="checkbox-1"
                  className="ms-2 text-sm font-medium "
                >
                  {isKickMemberEnabled
                    ? "Admins can expel members"
                    : "Admins can not expel members"}
                </label>
              </div>

              {/* Covenant text */}
              <label htmlFor="councilSafe" className={labelClassname}>
                Covenant descrition
              </label>
              <textarea
                className="textarea textarea-info line-clamp-5"
                placeholder="1Hive is a community of ...The goal of the 1Hive protocol is to foster a healthy community Our Standards...
              Examples of behavior that contributes to a positive environment ..."
                rows={7}
                onChange={(e) => setCovenant(e.target.value)}
              ></textarea>

              {/* Upload image */}
              <label htmlFor="cover-photo" className={labelClassname}>
                Banner Image
              </label>
              <div className="mt-2  flex justify-center rounded-lg border border-dashed border-secondary px-6 py-10">
                <div className="text-center">
                  {file ? (
                    <Image
                      src={URL.createObjectURL(file)}
                      alt="Project cover photo"
                      width={100}
                      height={100}
                    />
                  ) : (
                    <>
                      <div className="mt-4 flex flex-col text-sm leading-6 text-gray-400 ">
                        <PhotoIcon
                          className="mx-auto h-12 w-12 text-secondary"
                          aria-hidden="true"
                        />
                        <label
                          htmlFor={"image"}
                          className="relative cursor-pointer rounded-lg bg-surface font-semibold transition-colors duration-200 ease-in-out focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-200 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:text-primary"
                        >
                          <span className="text-secondary">Upload a file</span>
                          <input
                            id={"image"}
                            name={"image"}
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </label>

                        <div className="mt-1 space-y-1">
                          <p className="pl-1 text-black">or drag and drop</p>
                          <p className="text-xs leading-5 text-black">
                            PNG, JPG, GIF up to 10MB
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <CommunityOverview data={previewData} />
          )}

          <div className="flex w-full items-center justify-center py-6">
            {!isEditMode ? (
              <Button type="button" onClick={handlePreview} variant="fill">
                Preview
              </Button>
            ) : (
              <div className="flex items-center gap-10">
                <Button type="submit">Submit</Button>
                <Button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  variant="fill"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>
        </form>
      </FormModal>
    </>
  );
};

const CommunityOverview: React.FC<PreviewDataProps> = (data) => {
  const {
    name,
    stake,
    isKickMemberEnabled,
    feeAmount,
    feeReceiver,
    councilSafe,
    covenant,
    file,
  } = data.data;

  return (
    <>
      <div className="px-4 sm:px-0">
        <p className="mt-0 max-w-2xl text-sm leading-6 text-gray-500">
          Check details and covenant description
        </p>
      </div>
      <div>
        {data && (
          <div className="relative">
            {file && (
              <div>
                <Image
                  src={URL.createObjectURL(file)}
                  alt="Project cover photo"
                  width={100}
                  height={100}
                  className="absolute right-20 top-2"
                />
              </div>
            )}
            <PreviewData label="CommunityName" data={name} />
            <PreviewData label="Member Stake Amount" data={stake} />
            <PreviewData
              label="Council can expel members"
              data={isKickMemberEnabled ? "Yes" : "No"}
            />
            <PreviewData
              label="Protocol Fee Amount"
              data={`${feeAmount ?? "0"} %`}
            />
            <PreviewData label="Fee Receiver" data={feeReceiver} />
            <PreviewData label="Council Safe" data={councilSafe} />

            <h3 className="text-sm font-medium leading-6 text-gray-900">
              Covenant
            </h3>
            <p className="text-md max-h-56 overflow-y-auto rounded-xl border p-2 leading-7">
              {covenant}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

const PreviewData = ({ label, data }: { label: string; data: any }) => {
  return (
    <div className="px-4 py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
      <dt className="text-sm font-medium leading-6 text-gray-900">{label}</dt>
      <dd className="mt-1 text-lg leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
        {data}
      </dd>
    </div>
  );
};
