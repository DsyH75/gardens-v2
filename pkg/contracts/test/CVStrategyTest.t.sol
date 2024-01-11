// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAllo} from "allo-v2-contracts/core/interfaces/IAllo.sol";
import {IStrategy} from "allo-v2-contracts/core/interfaces/IStrategy.sol";
// Core contracts
import {Allo} from "allo-v2-contracts/core/Allo.sol";
import {Registry} from "allo-v2-contracts/core/Registry.sol";
// Internal Libraries
import {Errors} from "allo-v2-contracts/core/libraries/Errors.sol";
import {Metadata} from "allo-v2-contracts/core/libraries/Metadata.sol";
import {Native} from "allo-v2-contracts/core/libraries/Native.sol";
// Test libraries
import {AlloSetup} from "allo-v2-test/foundry/shared/AlloSetup.sol";
import {RegistrySetupFull} from "allo-v2-test/foundry/shared/RegistrySetup.sol";
import {TestStrategy} from "allo-v2-test/utils/TestStrategy.sol";
import {MockStrategy} from "allo-v2-test/utils/MockStrategy.sol";
import {MockERC20} from "allo-v2-test/utils/MockERC20.sol";

import {CVStrategy} from "../src/CVStrategy.sol";
import {RegistryGardens} from "../src/RegistryGardens.sol";
import {RegistryFactory} from "../src/RegistryFactory.sol";

import {GasHelpers2} from "./shared/GasHelpers2.sol";
import {SafeSetup} from "./shared/SafeSetup.sol";
import {CVStrategyHelpers} from "./CVStrategyHelpers.sol";
/* @dev Run 
* forge test --mc CVStrategyTest -vvvvv
* forge test --mt testRevert -vvvv
* forge test --mc CVStrategyTest --mt test -vv 
*/

contract CVStrategyTest is Test, AlloSetup, RegistrySetupFull, CVStrategyHelpers, Errors, GasHelpers2, SafeSetup {
    MockERC20 public token;
    uint256 public mintAmount = 15000;
    uint256 public constant TOTAL_SUPPLY = 45000;
    uint256 public constant POOL_AMOUNT = 15000;
    uint256 public constant MINIMUM_STAKE = 50;
    uint256 public constant REQUESTED_AMOUNT = 1000;

    RegistryGardens internal registryGardens;

    function setUp() public {
        __RegistrySetupFull();
        __AlloSetup(address(registry()));

        vm.startPrank(allo_owner());
        allo().updateBaseFee(0);
        allo().updatePercentFee(0);
        vm.stopPrank();

        token = new MockERC20();
        token.mint(local(), TOTAL_SUPPLY / 2);
        token.mint(pool_admin(), TOTAL_SUPPLY / 2);
        token.approve(address(allo()), mintAmount);

        vm.startPrank(allo_owner());
        allo().transferOwnership(local());
        vm.stopPrank();

        // registryGardens = new RegistryGardens();
        RegistryFactory registryFactory = new RegistryFactory();
        RegistryGardens.InitializeParams memory params;
        params._allo = address(allo());
        params._gardenToken = IERC20(address(token));
        params._minimumStakeAmount = MINIMUM_STAKE;
        params._protocolFee = 2;
        params._metadata = metadata;
        params._councilSafe = payable(address(_councilSafe()));
        registryGardens = RegistryGardens(registryFactory.createRegistry(params));

        token.approve(address(registryGardens), registryGardens.getBasisStakedAmount());
    }

    function _registryGardens() internal view returns (RegistryGardens) {
        return registryGardens;
    }

    /**
     *   HELPERS FUNCTIONS
     */
    function _createProposal(address _tokenPool, uint256 requestAmount, uint256 poolAmount)
        public
        returns (IAllo.Pool memory pool, uint256 poolId)
    {
        if (requestAmount == 0) {
            requestAmount = REQUESTED_AMOUNT;
        }

        if (poolAmount == 0) {
            poolAmount = POOL_AMOUNT;
        }
        address useTokenPool = NATIVE;
        if (_tokenPool == address(0)) {
            useTokenPool = address(token);
        }

        startMeasuringGas("createProposal");
        // allo().addToCloneableStrategies(address(strategy));

        vm.startPrank(pool_admin());

        CVStrategy strategy = new CVStrategy(address(allo()));

        poolId = createPool(allo(), address(strategy), address(_registryGardens()), registry(), address(useTokenPool));

        vm.stopPrank();

        strategy.activatePoints();

        pool = allo().getPool(poolId);

        vm.deal(address(this), poolAmount);
        if (useTokenPool == NATIVE) {
            allo().fundPool{value: poolAmount}(poolId, poolAmount);
        } else {
            MockERC20(useTokenPool).mint(address(this), poolAmount);
            MockERC20(useTokenPool).approve(address(allo()), poolAmount);
            allo().fundPool(poolId, poolAmount);
        }

        assertEq(pool.profileId, poolProfile_id1(registry()), "poolProfileID");
        // assertNotEq(address(pool.strategy), address(strategy), "Strategy Clones");

        startMeasuringGas("createProposal");

        CVStrategy.CreateProposal memory proposal = CVStrategy.CreateProposal(
            1, poolId, pool_admin(), CVStrategy.ProposalType.Funding, requestAmount, address(useTokenPool)
        );
        bytes memory data = abi.encode(proposal);
        allo().registerRecipient(poolId, data);

        stopMeasuringGas();
    }

    function getBalance(address _token, address holder) public view returns (uint256) {
        if (_token == NATIVE) {
            return address(holder).balance;
        } else {
            return IERC20(_token).balanceOf(address(holder));
        }
    }
    /**
     *    TESTS
     */

    function testRevert_allocate_ProposalIdDuplicated() public {
        ( /*IAllo.Pool memory pool*/ , uint256 poolId) = _createProposal(NATIVE, 0, 0);

        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](2);
        // votes[0] = CVStrategy.ProposalSupport(1, 70); // 0 + 70 = 70% = 35
        votes[0] = CVStrategy.ProposalSupport(1, 80); // 0 + 70 = 70% = 35
        votes[1] = CVStrategy.ProposalSupport(1, 20); // 70 + 20 = 90% = 45
        // votes[2] = CVStrategy.ProposalSupport(1, -10); // 90 - 10 = 80% = 40
        // 35 + 45 + 40 = 120
        bytes memory data = abi.encode(votes);
        // vm.expectRevert(CVStrategy.ProposalSupportDuplicated.selector);
        vm.expectRevert(abi.encodeWithSelector(CVStrategy.ProposalSupportDuplicated.selector, 1, 0));
        allo().allocate(poolId, data);
        stopMeasuringGas();
    }

    function testRevert_allocate_UserNotInRegistry() public {
        ( /*IAllo.Pool memory pool*/ , uint256 poolId) = _createProposal(NATIVE, 0, 0);

        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](2);
        // votes[0] = CVStrategy.ProposalSupport(1, 70); // 0 + 70 = 70% = 35
        votes[0] = CVStrategy.ProposalSupport(1, 80); // 0 + 70 = 70% = 35
        votes[1] = CVStrategy.ProposalSupport(1, 20); // 70 + 20 = 90% = 45
        // votes[2] = CVStrategy.ProposalSupport(1, -10); // 90 - 10 = 80% = 40
        // 35 + 45 + 40 = 120
        bytes memory data = abi.encode(votes);
        vm.startPrank(pool_admin());
        vm.expectRevert(CVStrategy.UserNotInRegistry.selector);
        // vm.expectRevert(abi.encodeWithSelector(CVStrategy.ProposalSupportDuplicated.selector, 1, 0));
        allo().allocate(poolId, data);

        vm.stopPrank();
        stopMeasuringGas();
    }

    function testRevert_allocate_removeSupport_wo_support_before_SUPPORT_UNDERFLOW() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, -100);
        bytes memory data = abi.encode(votes);

        vm.expectRevert(abi.encodeWithSelector(CVStrategy.SupportUnderflow.selector, 0, -100, -100));
        allo().allocate(poolId, data);
        stopMeasuringGas();

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        assertEq(cv.getProposalVoterStake(1, address(this)), 0, "VoterStakeAmount"); // 100% of 50 = 50
        assertEq(cv.getProposalStakedAmount(1), 0, "TotalStakedAmountInProposal");
    }

    function testRevert_registerRecipient_ProposalIdAlreadyExist() public {
        (, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        CVStrategy.CreateProposal memory proposal = CVStrategy.CreateProposal(
            1, poolId, pool_admin(), CVStrategy.ProposalType.Signaling, REQUESTED_AMOUNT, NATIVE
        );
        bytes memory data = abi.encode(proposal);
        vm.expectRevert(abi.encodeWithSelector(CVStrategy.ProposalIdAlreadyExist.selector, 1));
        allo().registerRecipient(poolId, data);
    }

    function test_proposalSupported_change_support() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        /**
         * ASSERTS
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, 80); // 0 + 70 = 70% = 35 range is -100 +100
        bytes memory data = abi.encode(votes);

        allo().allocate(poolId, data);

        stopMeasuringGas();
        uint256 STAKED_AMOUNT = 80 * MINIMUM_STAKE / 100;
        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));
        assertEq(cv.getProposalVoterStake(1, address(this)), STAKED_AMOUNT); // 80% of 50 = 40
        assertEq(cv.getProposalStakedAmount(1), STAKED_AMOUNT); // 80% of 50 = 40

        /**
         * ASSERTS
         *
         */
        // vm.startPrank(pool_admin());

        // token.approve(address(registryGardens), registryGardens.getBasisStakedAmount());
        // registryGardens.stakeAndregisterMember();

        CVStrategy.ProposalSupport[] memory votes2 = new CVStrategy.ProposalSupport[](1);
        votes2[0] = CVStrategy.ProposalSupport(1, 20);
        data = abi.encode(votes2);
        // vm.expectEmit(true, true, true, false);
        allo().allocate(poolId, data);
        // vm.stopPrank();

        assertEq(cv.getProposalVoterStake(1, address(this)), MINIMUM_STAKE); // 100% of 50 = 50
        assertEq(cv.getProposalStakedAmount(1), MINIMUM_STAKE);
    }

    function test_conviction_check_function() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        cv.setDecay(_etherToFloat(0.9 ether)); // alpha = decay
        cv.setMaxRatio(_etherToFloat(0.2 ether)); // beta = maxRatio
        cv.setWeight(_etherToFloat(0.002 ether)); // RHO = p  = weight

        /**
         * ASSERTS
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, 80);
        bytes memory data = abi.encode(votes);
        allo().allocate(poolId, data);
        stopMeasuringGas();

        uint256 AMOUNT_STAKED = 80 * MINIMUM_STAKE / 100;
        assertEq(cv.getProposalVoterStake(1, address(this)), AMOUNT_STAKED);
        assertEq(cv.getProposalStakedAmount(1), AMOUNT_STAKED);

        uint256 cv_amount = cv.calculateConviction(10, 0, AMOUNT_STAKED);
        console.log("cv_amount: %s", cv_amount);
        uint256 cv_cmp = _calculateConviction(10, 0, AMOUNT_STAKED, 0.9 ether / 10 ** 11);
        console.log("cv_cmp: %s", cv_cmp);
        assertEq(cv_amount, cv_cmp);
    }

    function test_conviction_check_as_js_test() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        cv.setDecay(_etherToFloat(0.9 ether)); // alpha = decay
        cv.setMaxRatio(_etherToFloat(0.2 ether)); // beta = maxRatio
        cv.setWeight(_etherToFloat(0.002 ether)); // RHO = p  = weight
        uint256 AMOUNT_STAKED = 45000;

        // registryGardens.setBasisStakedAmount(AMOUNT_STAKED);
        safeHelper(
            address(registryGardens),
            0,
            abi.encodeWithSelector(registryGardens.setBasisStakedAmount.selector, AMOUNT_STAKED)
        );
        /**
         * ASSERTS
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, 100);
        bytes memory data = abi.encode(votes);
        allo().allocate(poolId, data);
        stopMeasuringGas();

        assertEq(cv.getProposalVoterStake(1, address(this)), AMOUNT_STAKED);
        assertEq(cv.getProposalStakedAmount(1), AMOUNT_STAKED);

        uint256 AMOUNT_STAKED_1 = 15000;
        uint256 cv_amount = cv.calculateConviction(10, 0, AMOUNT_STAKED_1);

        console.log("cv_amount: %s", cv_amount);
        uint256 cv_cmp = _calculateConviction(10, 0, AMOUNT_STAKED_1, 0.9 ether / 10 ** 11);
        console.log("cv_cmp: %s", cv_cmp);

        assertEq(cv_amount, cv_cmp);
        assertEq(AMOUNT_STAKED_1, 15000);
        assertEq(AMOUNT_STAKED, 45000);
        assertEq(cv_amount, 97698);

        // registryGardens.setBasisStakedAmount(MINIMUM_STAKE);
        safeHelper(
            address(registryGardens),
            0,
            abi.encodeWithSelector(registryGardens.setBasisStakedAmount.selector, MINIMUM_STAKE)
        );
    }

    function disabled_test_threshold_check_as_js_test() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        cv.setDecay(_etherToFloat(0.9 ether)); // alpha = decay
        cv.setMaxRatio(_etherToFloat(0.2 ether)); // beta = maxRatio
        cv.setWeight(_etherToFloat(0.002 ether)); // RHO = p  = weight
        // registryGardens.setBasisStakedAmount(45000);
        safeHelper(
            address(registryGardens), 0, abi.encodeWithSelector(registryGardens.setBasisStakedAmount.selector, 45000)
        );
        /**
         * ASSERTS
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, 100); // 0 + 70 = 70% = 35
        bytes memory data = abi.encode(votes);
        allo().allocate(poolId, data);
        stopMeasuringGas();

        uint256 AMOUNT_STAKED = 45000;
        assertEq(cv.getProposalVoterStake(1, address(this)), AMOUNT_STAKED); // 80% of 50 = 40
        assertEq(cv.getProposalStakedAmount(1), AMOUNT_STAKED); // 80% of 50 = 40

        uint256 ct1 = cv.calculateThreshold(1000);
        console.log("threshold %s", ct1);
        assertEq(AMOUNT_STAKED, 45000);
        assertEq(ct1, 50625);

        // registryGardens.setBasisStakedAmount(MINIMUM_STAKE);
        safeHelper(
            address(registryGardens),
            0,
            abi.encodeWithSelector(registryGardens.setBasisStakedAmount.selector, MINIMUM_STAKE)
        );
    }

    function test_total_staked_amount() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);
        // registryGardens.setBasisStakedAmount(45000);
        safeHelper(
            address(registryGardens), 0, abi.encodeWithSelector(registryGardens.setBasisStakedAmount.selector, 45000)
        );
        /**
         * ASSERTS
         */
        // startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, 100);
        bytes memory data = abi.encode(votes);
        allo().allocate(poolId, data);
        // stopMeasuringGas();

        uint256 AMOUNT_STAKED = 45000;
        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));
        assertEq(cv.getProposalVoterStake(1, address(this)), AMOUNT_STAKED);
        assertEq(cv.getProposalStakedAmount(1), AMOUNT_STAKED);

        votes[0] = CVStrategy.ProposalSupport(1, -100);
        data = abi.encode(votes);
        allo().allocate(poolId, data);

        assertEq(cv.getProposalVoterStake(1, address(this)), 0, "VoterStake");
        assertEq(cv.getProposalStakedAmount(1), 0, "StakedAmount");

        assertEq(cv.totalStaked(), 0, "TotalStaked");

        // registryGardens.setBasisStakedAmount(MINIMUM_STAKE);
        safeHelper(
            address(registryGardens),
            0,
            abi.encodeWithSelector(registryGardens.setBasisStakedAmount.selector, MINIMUM_STAKE)
        );
    }

    function test_allocate_proposalSupport_empty_array() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](2);
        votes[0] = CVStrategy.ProposalSupport(1, 100);
        votes[1];
        bytes memory data = abi.encode(votes);

        // vm.expectRevert(abi.encodeWithSelector(CVStrategy.SupportUnderflow.selector, 0, -100, -100));
        allo().allocate(poolId, data);
        stopMeasuringGas();

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        assertEq(cv.getProposalVoterStake(1, address(this)), MINIMUM_STAKE); // 100% of 50 = 50
        assertEq(cv.getProposalStakedAmount(1), MINIMUM_STAKE);
    }

    function test_proposalSupported_conviction_threshold_2_users() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(address(0), 50 ether, 1_000 ether);

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        // cv.setDecay(_etherToFloat(0.9999987 ether)); // alpha = decay
        // cv.setMaxRatio(_etherToFloat(0.7 ether)); // beta = maxRatio
        // cv.setWeight(_etherToFloat(0.049 ether)); // RHO = p  = weight

        // FAST 1 MIN GROWTH
        cv.setDecay(_etherToFloat(0.9965402 ether)); // alpha = decay
        cv.setMaxRatio(_etherToFloat(0.1 ether)); // beta = maxRatio
        cv.setWeight(_etherToFloat(0.0005 ether)); // RHO = p  = weight
        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        int256 SUPPORT_PCT = 100;
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, SUPPORT_PCT); // 0 + 70 = 70% = 35
        bytes memory data = abi.encode(votes);
        allo().allocate(poolId, data);
        stopMeasuringGas();

        uint256 STAKED_AMOUNT = uint256(SUPPORT_PCT) * MINIMUM_STAKE / 100;
        assertEq(cv.getProposalVoterStake(1, address(this)), STAKED_AMOUNT); // 80% of 50 = 40
        assertEq(cv.getProposalStakedAmount(1), STAKED_AMOUNT); // 80% of 50 = 40

        /**
         * ASSERTS
         *
         */
        vm.startPrank(pool_admin());

        // token.approve(address(registryGardens), registryGardens.getBasisStakedAmount());
        cv.activatePoints();

        CVStrategy.ProposalSupport[] memory votes2 = new CVStrategy.ProposalSupport[](1);
        int256 SUPPORT_PCT2 = 100;
        votes2[0] = CVStrategy.ProposalSupport(1, SUPPORT_PCT2);
        data = abi.encode(votes2);
        // vm.expectEmit(true, true, true, false);
        allo().allocate(poolId, data);
        vm.stopPrank();

        uint256 STAKED_AMOUNT2 = uint256(SUPPORT_PCT2) * MINIMUM_STAKE / 100;

        assertEq(cv.getProposalVoterStake(1, address(pool_admin())), STAKED_AMOUNT2); // 100% of 50 = 50
        assertEq(cv.getProposalStakedAmount(1), STAKED_AMOUNT + STAKED_AMOUNT2);

        /**
         * ASSERTS
         *
         */
        console.log("before block.number", block.number);
        uint256 totalEffectiveActivePoints = cv.totalEffectiveActivePoints();
        console.log("totalEffectiveActivePoints", totalEffectiveActivePoints);
        console.log("maxCVSupply", cv.getMaxConviction(totalEffectiveActivePoints));
        console.log("maxCVStaked", cv.getMaxConviction(cv.getProposalStakedAmount(1)));

        assertEq(cv.getMaxConviction(totalEffectiveActivePoints), 289034, "maxCVSupply");
        assertEq(cv.getMaxConviction(cv.getProposalStakedAmount(1)), 28903, "maxCVStaked");

        vm.roll(110);
        console.log("after block.number", block.number);
        // x = 8731 / 149253
        // x = 0.174 current tokens growth

        // convictionLast / maxConviction(effectivestaked) * 100 = stakedConviction in percetage of the effetiveSupply
        // threshold / maxConviction(effectivestaked)

        cv.updateProposalConviction(1);

        (
            ,
            ,
            ,
            uint256 requestedAmount,
            uint256 stakedTokens,
            ,
            ,
            ,
            uint256 convictionLast,
            ,
            uint256 threshold,
            uint256 voterPointsPct
        ) = cv.getProposal(1);

        console.log("Requested Amount: %s", requestedAmount);
        console.log("Staked Tokens: %s", stakedTokens);
        console.log("Threshold: %s", threshold);
        console.log("Conviction Last: %s", convictionLast);
        console.log("Voter points pct %s", voterPointsPct);
        assertEq(threshold, 57806, "threshold");
        assertEq(convictionLast, 9093, "convictionLast");
        assertEq(voterPointsPct, 100, "voterPointsPct");
    }

    function test_1_proposalSupported() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        int256 SUPPORT_PCT = 80;
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, SUPPORT_PCT); // 0 + 70 = 70% = 35
        bytes memory data = abi.encode(votes);
        allo().allocate(poolId, data);
        stopMeasuringGas();

        uint256 STAKED_AMOUNT = uint256(SUPPORT_PCT) * MINIMUM_STAKE / 100;
        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));
        assertEq(cv.getProposalVoterStake(1, address(this)), STAKED_AMOUNT, "ProposalVoterStake1"); // 80% of 50 = 40
        assertEq(cv.getProposalStakedAmount(1), STAKED_AMOUNT); // 80% of 50 = 40

        /**
         * ASSERTS
         *
         */
        vm.startPrank(pool_admin());

        uint256 proposalID2 = 2;
        CVStrategy.CreateProposal memory proposal = CVStrategy.CreateProposal(
            proposalID2, poolId, pool_admin(), CVStrategy.ProposalType.Funding, REQUESTED_AMOUNT, address(token)
        );
        bytes memory data2 = abi.encode(proposal);
        allo().registerRecipient(poolId, data2);

        token.approve(address(registryGardens), registryGardens.getBasisStakedAmount());
        // registryGardens.stakeAndRegisterMember();
        cv.activatePoints();

        CVStrategy.ProposalSupport[] memory votes2 = new CVStrategy.ProposalSupport[](1);
        int256 SUPPORT_PCT2 = 100;
        votes2[0] = CVStrategy.ProposalSupport(proposalID2, SUPPORT_PCT2);
        data = abi.encode(votes2);
        // vm.expectEmit(true, true, true, false);
        allo().allocate(poolId, data);
        vm.stopPrank();

        uint256 STAKED_AMOUNT2 = uint256(SUPPORT_PCT2) * MINIMUM_STAKE / 100;

        assertEq(cv.getProposalVoterStake(proposalID2, address(pool_admin())), STAKED_AMOUNT2, "ProposalVoterStake2"); // 100% of 50 = 50
        assertEq(cv.getProposalStakedAmount(proposalID2), STAKED_AMOUNT2, "StakedMount2");

        /**
         * ASSERTS
         *
         */
        console.log("before block.number", block.number);
        console.log("maxCVSupply", cv.getMaxConviction(cv.totalStaked()));
        console.log("maxCVStaked", cv.getMaxConviction(cv.getProposalStakedAmount(1)));
        vm.roll(10);
        console.log("after block.number", block.number);

        cv.updateProposalConviction(1);

        (
            ,
            ,
            ,
            uint256 requestedAmount,
            uint256 stakedTokens,
            ,
            ,
            ,
            uint256 convictionLast,
            ,
            uint256 threshold,
            uint256 voterPointsPct
        ) = cv.getProposal(1);

        console.log("Requested Amount: %s", requestedAmount);
        console.log("Staked Tokens: %s", stakedTokens);
        console.log("Threshold: %s", threshold);
        console.log("Conviction Last: %s", convictionLast);
        console.log("Voter points pct %s", voterPointsPct);
    }

    function test_distribute_native_token() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(NATIVE, 0, 0);

        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        int256 SUPPORT_PCT = 100;
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(1, SUPPORT_PCT); // 0 + 70 = 70% = 35
        // bytes memory data = ;
        allo().allocate(poolId, abi.encode(votes));
        stopMeasuringGas();

        uint256 STAKED_AMOUNT = uint256(SUPPORT_PCT) * MINIMUM_STAKE / 100;
        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));
        assertEq(cv.getProposalVoterStake(1, address(this)), STAKED_AMOUNT); // 80% of 50 = 40
        assertEq(cv.getProposalStakedAmount(1), STAKED_AMOUNT); // 80% of 50 = 40

        (
            ,
            address beneficiary,
            ,
            uint256 requestedAmount,
            uint256 stakedTokens,
            ,
            ,
            uint256 blockLast,
            uint256 convictionLast,
            ,
            uint256 threshold,
            // uint256 voterPointsPct
        ) = cv.getProposal(1);

        // console.log("Proposal Status: %s", proposalStatus);
        // console.log("Proposal Type: %s", proposalType);
        // console.log("Requested Token: %s", requestedToken);
        console.log("Requested Amount: %s", requestedAmount);
        console.log("Staked Tokens: %s", stakedTokens);
        console.log("Threshold: %s", threshold);
        // console.log("Agreement Action Id: %s", agreementActionId);
        console.log("Block Last: %s", blockLast);
        console.log("Conviction Last: %s", convictionLast);
        // console.log("Voter points pct %s", voterPointsPct);
        // console.log("Beneficiary: %s", beneficiary);
        // console.log("Submitter: %s", submitter);
        address[] memory recipients = new address[](0);
        // recipients[0] = address(1);
        bytes memory dataProposal = abi.encode(1);

        uint256 amount = getBalance(pool.token, beneficiary);
        // console.log("Beneficienry Before amount: %s", amount);

        assertEq(amount, 0);

        allo().distribute(poolId, recipients, dataProposal);
        amount = getBalance(pool.token, beneficiary);
        // console.log("Beneficienry After amount: %s", amount);
        assertEq(amount, requestedAmount);
    }

    function test_distribute_signaling_proposal() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(address(0), 0, 0);

        startMeasuringGas("createProposal");

        CVStrategy.CreateProposal memory proposal =
            CVStrategy.CreateProposal(2, poolId, address(0), CVStrategy.ProposalType.Signaling, 0, address(0));
        bytes memory data = abi.encode(proposal);
        allo().registerRecipient(poolId, data);

        stopMeasuringGas();
        /**
         * ASSERTS
         *
         */
        startMeasuringGas("Support a Proposal");
        int256 SUPPORT_PCT = 100;
        uint256 PROPOSAL_ID = 2;
        CVStrategy.ProposalSupport[] memory votes = new CVStrategy.ProposalSupport[](1);
        votes[0] = CVStrategy.ProposalSupport(PROPOSAL_ID, SUPPORT_PCT); // 0 + 70 = 70% = 35
        // bytes memory data = ;
        allo().allocate(poolId, abi.encode(votes));
        stopMeasuringGas();

        uint256 STAKED_AMOUNT = uint256(SUPPORT_PCT) * MINIMUM_STAKE / 100;
        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));
        assertEq(cv.getProposalVoterStake(PROPOSAL_ID, address(this)), STAKED_AMOUNT); // 80% of 50 = 40
        assertEq(cv.getProposalStakedAmount(PROPOSAL_ID), STAKED_AMOUNT); // 80% of 50 = 40

        (
            ,
            ,
            ,
            uint256 requestedAmount,
            uint256 stakedTokens,
            ,
            ,
            uint256 blockLast,
            uint256 convictionLast,
            ,
            uint256 threshold,
            // uint256 voterPointsPct
        ) = cv.getProposal(1);

        // console.log("Proposal Status: %s", proposalStatus);
        // console.log("Proposal Type: %s", proposalType);
        // console.log("Requested Token: %s", requestedToken);
        console.log("Requested Amount: %s", requestedAmount);
        console.log("Staked Tokens: %s", stakedTokens);
        console.log("Threshold: %s", threshold);
        // console.log("Agreement Action Id: %s", agreementActionId);
        console.log("Block Last: %s", blockLast);
        console.log("Conviction Last: %s", convictionLast);
        // console.log("Voter points pct %s", voterPointsPct);
        // console.log("Beneficiary: %s", beneficiary);
        // console.log("Submitter: %s", submitter);
        // address[] memory recipients = ;
        // recipients[0] = address(1);
        bytes memory dataProposal = abi.encode(PROPOSAL_ID);

        allo().distribute(poolId, new address[](0), dataProposal);
        // console.log("Beneficienry After amount: %s", amount);
    }

    function test_activate_points() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(address(0), 0, 0);

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        vm.expectRevert(abi.encodeWithSelector(RegistryGardens.UserAlreadyActivated.selector));
        cv.activatePoints();

        vm.startPrank(pool_admin());
        cv.activatePoints();
        vm.stopPrank();

        assertEq(registryGardens.isMember(pool_admin()), true, "isMember");
    }

    function test_deactivate_points() public {
        (IAllo.Pool memory pool, uint256 poolId) = _createProposal(address(0), 0, 0);

        CVStrategy cv = CVStrategy(payable(address(pool.strategy)));

        vm.expectRevert(abi.encodeWithSelector(RegistryGardens.UserAlreadyActivated.selector));
        cv.activatePoints();

        cv.deactivatePoints();
        // assertEq(registryGardens.isMember(local()), false, "isMember");

        vm.startPrank(pool_admin());
        cv.activatePoints();
        cv.deactivatePoints();
        vm.stopPrank();

        // assertEq(registryGardens.isMember(pool_admin()), false, "isMember");
    }
}
