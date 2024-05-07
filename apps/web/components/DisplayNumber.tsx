"use client";
import * as dn from "dnum";
import { doesNotReject } from "assert";
import { useEffect, useState } from "react";

export const DisplayNumber = ({
  number,
  tokenSymbol,
  className,
  compact,
}: {
  number: dn.Dnum;
  tokenSymbol?: string;
  className?: string;
  compact?: boolean;
}) => {
  const [fullNumberStr, setFullNumberStr] = useState(dn.format(number));
  const [isCopied, setIsCopied] = useState(false);
  const [shortNumber, setShortNumber] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    setShortNumber(parseString(fullNumberStr));
  }, []);

  const parseString = (str: string | undefined) => {
    const charsLength = 3;
    const prefixLength = 2; // "0."
    if (!str) {
      setShowTooltip(false);
      return "";
    }
    if (str.length < charsLength * 2 + prefixLength) {
      setShowTooltip(false);
      return str;
    }
    setShowTooltip(true);
    if (str.slice(0, 2) === "0.")
      return (
        str.slice(0, charsLength + prefixLength - 1) +
        "…" +
        str.slice(-charsLength)
      );
    return dn.format(number, { compact: compact });
  };

  const handleCopy = async () => {
    if (showTooltip === false) setShowTooltip(true);
    try {
      await navigator.clipboard.writeText(fullNumberStr ?? "");
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
        if (showTooltip === false) setShowTooltip(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="relative ml-2 flex items-center gap-1">
      <div
        onClick={handleCopy}
        className={`${showTooltip && "tooltip"} cursor-pointer ${className}`}
        data-tip={isCopied ? "Copied!" : fullNumberStr}
      >
        <p>{shortNumber}</p>
      </div>
      <p>{tokenSymbol}</p>
    </div>
  );
};
