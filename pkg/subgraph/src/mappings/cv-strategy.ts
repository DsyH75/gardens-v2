import {
  CVProposal,
  CVStrategy,
  CVStrategyConfig,
  Member,
  MemberCommunity,
  Stake,
  // ProposalMeta as ProposalMetadata,
} from "../../generated/schema";
// import { ProposalMetadata as ProposalMetadataTemplate } from "../../generated/templates";

import {
  Distributed,
  InitializedCV,
  ProposalCreated,
  CVStrategy as CVStrategyContract,
  PoolAmountIncreased,
  SupportAdded,
  PowerIncreased,
  PowerDecreased,
  DecayUpdated,
  MaxRatioUpdated,
  MinThresholdPointsUpdated,
  WeightUpdated,
} from "../../generated/templates/CVStrategy/CVStrategy";

import { Allo as AlloContract } from "../../generated/templates/CVStrategy/Allo";

import { BigInt, log } from "@graphprotocol/graph-ts";

// export const CTX_PROPOSAL_ID = "proposalId";
// export const CTX_METADATA_ID = "metadataId";

export function handleInitialized(event: InitializedCV): void {
  log.debug("handleInitialized", []);
  const poolId = event.params.poolId;
  const registryCommunity = event.params.data.registryCommunity.toHexString();
  const decay = event.params.data.decay;
  const maxRatio = event.params.data.maxRatio;
  const minThresholdPoints = event.params.data.minThresholdPoints;
  const weight = event.params.data.weight;
  const pType = event.params.data.proposalType;
  const maxAmount = event.params.data.pointConfig.maxAmount;
  const pointSystem = event.params.data.pointSystem;

  log.debug(
    "handleInitialized registryCommunity:{} decay:{} maxRatio:{} minThresholdPoints:{} weight:{} pType:{} maxAmount:{}",
    [
      registryCommunity,
      decay.toString(),
      maxRatio.toString(),
      minThresholdPoints.toString(),
      weight.toString(),
      pType.toString(),
      maxAmount.toString(),
    ],
  );

  const cvc = CVStrategyContract.bind(event.address);

  let cvs = new CVStrategy(event.address.toHex());
  let alloAddr = cvc.getAllo();

  const allo = AlloContract.bind(alloAddr);

  let metadata = allo.getPool(poolId).metadata.pointer;
  if (metadata) {
    log.debug("metadata:{}", [metadata.toString()]);
    cvs.metadata = metadata ? metadata.toString() : null;
  }

  cvs.poolId = poolId;
  cvs.registryCommunity = registryCommunity;
  let config = new CVStrategyConfig(
    `${event.address.toHex()}-${poolId.toString()}-config`,
  );

  cvs.poolAmount = cvc.getPoolAmount();
  cvs.maxCVSupply = BigInt.fromI32(0);
  cvs.totalEffectiveActivePoints = cvc.totalEffectiveActivePoints();

  config.decay = decay;
  config.maxRatio = maxRatio;
  config.minThresholdPoints = minThresholdPoints;
  config.weight = weight;
  config.proposalType = BigInt.fromI32(pType);
  config.pointSystem = BigInt.fromI32(pointSystem);
  config.maxAmount = maxAmount;

  config.D = cvc.D();
  config.save();

  cvs.config = config.id;

  cvs.save();
}

export function handleProposalCreated(event: ProposalCreated): void {
  const proposalIdString = event.params.proposalId.toHex();
  const cvsId = event.address.toHex();
  const cvc = CVStrategyContract.bind(event.address);

  log.debug("handleProposalCreated proposalIdString:{} cvsId:{} ", [
    proposalIdString,
    cvsId,
  ]);

  let p = cvc.try_getProposal(event.params.proposalId);
  if (p.reverted) {
    log.error("handleProposalCreated proposal reverted:{}", [proposalIdString]);
    return;
  }
  let proposal = p.value;

  const proposalStakedAmount = cvc.getProposalStakedAmount(
    event.params.proposalId,
  );
  const maxConviction = cvc.getMaxConviction(proposalStakedAmount);

  let newProposal = new CVProposal(proposalIdString);
  newProposal.strategy = cvsId;

  newProposal.beneficiary = proposal.getBeneficiary().toHex();
  let requestedToken = proposal.getRequestedToken();
  newProposal.requestedToken = requestedToken.toHex();

  newProposal.blockLast = proposal.getBlockLast();
  newProposal.convictionLast = proposal.getConvictionLast();
  newProposal.threshold = proposal.getThreshold();
  newProposal.stakedAmount = proposal.getStakedAmount();

  newProposal.requestedAmount = proposal.getRequestedAmount();
  newProposal.maxCVStaked = maxConviction;

  newProposal.proposalStatus = BigInt.fromI32(proposal.getProposalStatus());
  // newProposal.proposalType = BigInt.fromI32(proposal.proposalType());
  newProposal.submitter = proposal.getSubmitter().toHex();
  // newProposal.voterStakedPointsPct = proposal.getVoterStakedPointsPct();
  // newProposal.agreementActionId = proposal.getAgreementActionId();

  const pointer = cvc.getMetadata(event.params.proposalId).pointer;

  newProposal.metadata = pointer;
  // const metadataID = `${pointer}-${proposalIdString}`;
  const metadataID = `${pointer}`;
  // newProposal.proposalMeta = metadataID;
  log.debug("handleProposalCreated pointer:{}", [metadataID]);
  newProposal.createdAt = event.block.timestamp;
  newProposal.updatedAt = event.block.timestamp;

  // const ctx = dataSource.context();
  // ctx.setString(CTX_PROPOSAL_ID, proposalIdString);
  // ctx.setString(CTX_METADATA_ID, proposalIdString);
  // const pm = ProposalMetadata.load(pointer);
  // if (pm == null) {
  //   ProposalMetadataTemplate.createWithContext(pointer, ctx);
  // }

  newProposal.save();
}
// handlePoolAmountIncreased
export function handlePoolAmountIncreased(event: PoolAmountIncreased): void {
  log.debug("handlePoolAmountIncreased: amount: {}", [
    event.params.amount.toString(),
  ]);
  let cvs = CVStrategy.load(event.address.toHexString());
  if (cvs == null) {
    log.debug("handlePoolAmountIncreased cvs not found: {}", [
      event.address.toHexString(),
    ]);
    return;
  }
  cvs.poolAmount = event.params.amount;
  cvs.save();
}

export function handleSupportAdded(event: SupportAdded): void {
  log.debug("handleSupportAdded: amount: {}", [event.params.amount.toString()]);

  let cvp = CVProposal.load(event.params.proposalId.toHexString());
  if (cvp == null) {
    log.debug("handleSupportAdded cvp not found: {}", [
      event.params.proposalId.toString(),
    ]);
    return;
  }

  let cvs = CVStrategy.load(cvp.strategy);
  if (cvs == null) {
    log.debug("handleSupportAdded cvs not found: {}", [
      cvp.strategy.toString(),
    ]);
    return;
  }
  const memberCommunityId = `${event.params.from.toHexString()}-${cvs.registryCommunity.toString()}`;
  let stakeId = `${cvp.id.toString()}-${memberCommunityId}`;

  let stake = Stake.load(stakeId);
  if (!stake) {
    stake = new Stake(stakeId);
    stake.member = event.params.from.toHexString();
    stake.proposal = cvp.id;
  }
  stake.poolId = cvs.poolId;
  stake.amount = event.params.amount;
  stake.createdAt = event.block.timestamp;
  stake.save();

  const cvc = CVStrategyContract.bind(event.address);
  const proposalStakedAmount = cvc.getProposalStakedAmount(
    event.params.proposalId,
  );
  const maxConviction = cvc.getMaxConviction(proposalStakedAmount);

  let memberCommunity = MemberCommunity.load(memberCommunityId);
  if (memberCommunity == null) {
    log.debug("handleSupportAdded memberCommunity not found: {}", [
      memberCommunityId.toString(),
    ]);
    return;
  }

  memberCommunity.stakedPoints = memberCommunity.stakedPoints
    ? memberCommunity.stakedPoints!.plus(event.params.amount)
    : event.params.amount;

  memberCommunity.save();
  cvp.maxCVStaked = maxConviction;

  cvp.stakedAmount = event.params.totalStakedAmount;
  cvp.convictionLast = event.params.convictionLast;
  cvp.save();
}

export function handleDistributed(event: Distributed): void {
  log.debug("handleDistributed: amount: {}", [event.params.amount.toString()]);

  let cvp = CVProposal.load(event.params.proposalId.toHexString());
  if (cvp == null) {
    log.debug("handleDistributed cvp not found: {}", [
      event.params.proposalId.toString(),
    ]);
    return;
  }
  const cvc = CVStrategyContract.bind(event.address);
  const proposalStatus = cvc
    .getProposal(event.params.proposalId)
    .getProposalStatus();

  cvp.proposalStatus = BigInt.fromI32(proposalStatus);
  cvp.save();
}

export function handlePowerIncreased(event: PowerIncreased): void {
  let cvs = CVStrategy.load(event.address.toHexString());
  if (cvs == null) {
    log.debug("handlePowerIncreased cvs not found: {}", [
      event.address.toHexString(),
    ]);
    return;
  }

  const cvc = CVStrategyContract.bind(event.address);
  const totalEffectiveActivePoints = cvc.totalEffectiveActivePoints();
  cvs.totalEffectiveActivePoints = totalEffectiveActivePoints;

  cvs.save();

  const memberCommunityId = `${event.params.member.toHexString()}-${cvs.registryCommunity.toString()}`;

  let memberCommunity = MemberCommunity.load(memberCommunityId);
  if (memberCommunity == null) {
    log.debug("handlePowerIncreased memberCommunity not found: {}", [
      memberCommunityId.toString(),
    ]);
    return;
  }

  memberCommunity.stakedTokens = memberCommunity.stakedTokens
    ? memberCommunity.stakedTokens!.plus(event.params.tokensStaked)
    : event.params.tokensStaked;

  memberCommunity.activatedPoints = memberCommunity.activatedPoints
    ? memberCommunity.activatedPoints!.plus(event.params.pointsToIncrease)
    : event.params.pointsToIncrease;

  memberCommunity.save();
}

export function handlePowerDecreased(event: PowerDecreased): void {
  let cvs = CVStrategy.load(event.address.toHexString());
  if (cvs == null) {
    log.debug("handlePowerDecreased cvs not found: {}", [
      event.address.toHexString(),
    ]);
    return;
  }

  const cvc = CVStrategyContract.bind(event.address);
  const totalEffectiveActivePoints = cvc.totalEffectiveActivePoints();
  cvs.totalEffectiveActivePoints = totalEffectiveActivePoints;

  cvs.save();

  const memberCommunityId = `${event.params.member.toHexString()}-${cvs.registryCommunity.toString()}`;

  let memberCommunity = MemberCommunity.load(memberCommunityId);
  if (memberCommunity == null) {
    log.debug("handlePowerDecreased memberCommunity not found: {}", [
      memberCommunityId.toString(),
    ]);
    return;
  }

  memberCommunity.stakedTokens = memberCommunity.stakedTokens
    ? memberCommunity.stakedTokens!.minus(event.params.tokensUnStaked)
    : BigInt.fromI32(0);

  memberCommunity.activatedPoints = memberCommunity.activatedPoints
    ? memberCommunity.activatedPoints!.minus(event.params.pointsToDecrease)
    : BigInt.fromI32(0);

  memberCommunity.save();
}

export function handleDecayUpdated(event: DecayUpdated): void {
  let cvs = CVStrategy.load(event.address.toHexString());
  if (cvs == null) {
    log.debug("handleDecayUpdated cvs not found: {}", [
      event.address.toHexString(),
    ]);
    return;
  }
  if (cvs.config) {
    let config = CVStrategyConfig.load(cvs.config);
    if (config == null) {
      log.debug("handleDecayUpdated config not found: {}", [
        event.address.toHexString(),
      ]);
      return;
    }
    config.decay = event.params.decay;
    config.save();
  }
  return;
}

export function handleMaxRatioUpdated(event: MaxRatioUpdated): void {
  let cvs = CVStrategy.load(event.address.toHexString());
  if (cvs == null) {
    log.debug("handleMaxRatioUpdated cvs not found: {}", [
      event.address.toHexString(),
    ]);
    return;
  }
  if (cvs.config) {
    let config = CVStrategyConfig.load(cvs.config);
    if (config == null) {
      log.debug("handleMaxRatioUpdated config not found: {}", [
        event.address.toHexString(),
      ]);
      return;
    }
    config.maxRatio = event.params.maxRatio;
    config.save();
  }
  return;
}

export function handleMinThresholdPointsUpdated(
  event: MinThresholdPointsUpdated,
): void {
  let cvs = CVStrategy.load(event.address.toHexString());
  if (cvs == null) {
    log.debug("handleMaxRatioUpdated cvs not found: {}", [
      event.address.toHexString(),
    ]);
    return;
  }
  if (cvs.config) {
    let config = CVStrategyConfig.load(cvs.config);
    if (config == null) {
      log.debug("handleMaxRatioUpdated config not found: {}", [
        event.address.toHexString(),
      ]);
      return;
    }
    config.minThresholdPoints = event.params.minThresholdPoints;
    config.save();
  }
  return;
}

export function handleWeightUpdated(event: WeightUpdated): void {
  let cvs = CVStrategy.load(event.address.toHexString());
  if (cvs == null) {
    log.debug("handleWeightUpdated cvs not found: {}", [
      event.address.toHexString(),
    ]);
    return;
  }
  if (cvs.config) {
    let config = CVStrategyConfig.load(cvs.config);
    if (config == null) {
      log.debug("handleWeightUpdated config not found: {}", [
        event.address.toHexString(),
      ]);
      return;
    }
    config.weight = event.params.weight;
    config.save();
  }
  return;
}
