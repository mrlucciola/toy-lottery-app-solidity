import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Lottery } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractTransaction } from "ethers";

let lottery: Lottery;
let owner: SignerWithAddress;
let playerA: SignerWithAddress;
let playerB: SignerWithAddress;
let lotteryA: Lottery;
let lotteryB: Lottery;
let gameAmount: BigNumber;
let balancePreA: BigNumber;
let balancePreB: BigNumber;

describe("Lottery", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  before(async () => {
    // Contracts are deployed using the first signer/account by default
    [owner, playerA, playerB] = await ethers.getSigners();
    console.log("owner", owner.address);
    console.log("playerA", playerA.address);
    console.log("playerB", playerB.address);

    const Lottery = await ethers.getContractFactory("Lottery");

    gameAmount = ethers.utils.parseUnits("1.0", 18);
    lottery = await Lottery.deploy(gameAmount);
    lotteryA = lottery.connect(playerA);
    lotteryB = lottery.connect(playerB);
    balancePreA = await playerA.getBalance();
    balancePreB = await playerB.getBalance();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await lottery.manager()).to.equal(owner.address);
    });

    it("Should return the right 'amount'", async function () {
      expect(await lottery.amount()).to.equal(gameAmount);
    });
  });

  describe("Lottery Actions", () => {
    let gasPrice: BigNumber;
    let gasLimit: BigNumber;
    let gasCost: BigNumber;

    before(async () => {
      gasPrice = await lottery.provider.getGasPrice();
      gasLimit = await lottery.estimateGas.addPlayer({
        value: gameAmount,
      });
      gasCost = gasLimit.mul(gasPrice);
    });

    it("Should add player A and move funds", async function () {
      const playersPre = await lotteryA.getPlayers();
      // should be 0
      expect(playersPre.length).to.equal(0);

      // make the call
      expect(
        await lotteryA.addPlayer({ value: gameAmount, gasPrice, gasLimit })
      );

      // check
      const playersPost = await lotteryA.getPlayers();
      expect(playersPost.length).to.equal(1);
      expect(playersPost[0]).to.equal(await lotteryA.signer.getAddress());
    });
    it("Should fail enter player A twice", async () => {
      await expect(
        lotteryA.addPlayer({ value: gameAmount, gasPrice, gasLimit })
      ).to.be.revertedWith("player is already entered");
    });

    it("Should add player B and move funds", async function () {
      const playersPre = await lotteryB.getPlayers();
      // should be 0
      expect(playersPre.length).to.equal(1);
      // make the call
      await expect(
        lotteryB.addPlayer({ value: gameAmount, gasPrice, gasLimit })
      );

      // check the call
      const playersPost = await lotteryB.getPlayers();
      expect(playersPost.length).to.equal(2);
      expect(playersPost[0]).to.equal(await lotteryA.signer.getAddress());
      expect(playersPost[1]).to.equal(await lotteryB.signer.getAddress());
    });
    it("Should fail enter player B twice", async () => {
      await expect(
        lotteryB.addPlayer({ value: gameAmount, gasLimit, gasPrice })
      ).to.be.revertedWith("Game is full");
    });

    describe("Picking a winner", async function () {
      it("Should fail, unauthorized userA", async () => {
        await expect(lotteryA.pickWinner()).to.be.revertedWith(
          "Must be manager"
        );
      });
      it("Should fail, unauthorized userB", async () => {
        await expect(lotteryB.pickWinner()).to.be.revertedWith(
          "Must be manager"
        );
      });
      it("Should pick a winner", async () => {
        await lottery.pickWinner();
      });
      it("Player array should be empty", async () => {
        expect((await lottery.getPlayers()).length).to.equal(0);
      });

      it("Winner should have a higher account balance", async () => {
        // need to use a better gas limit calc

        const balancePostA: BigNumber = await playerA.getBalance();
        const balancePostB: BigNumber = await playerB.getBalance();

        const isAwinner = balancePostA.gt(balancePostB);
        if (isAwinner) {
          const calcA = balancePreA.add(gameAmount);
          const calcA1Gas = calcA.sub(gasCost);
          const calcA2Gas = calcA.sub(gasCost.mul(2));

          expect(balancePostA).gte(calcA2Gas).and.lte(calcA1Gas);
        } else {
          const calcB = balancePreB.add(gameAmount);
          const calcB1Gas = calcB.sub(gasCost);
          const calcB2Gas = calcB.sub(gasCost.mul(2));

          expect(balancePostB).gte(calcB2Gas).and.lte(calcB1Gas);
        }
      });
      it("Loser should have a lower account balance", async () => {
        // need to use a better gas limit calc
        const balancePostA: BigNumber = await playerA.getBalance();
        const balancePostB: BigNumber = await playerB.getBalance();

        const isALoser = balancePostA.lt(balancePostB);
        if (isALoser) {
          const calcA = balancePreA.sub(gameAmount);
          const calcA1Gas = calcA.sub(gasCost);
          const calcA2Gas = calcA.sub(gasCost.mul(2));
          expect(balancePostA).gte(calcA2Gas).and.lte(calcA1Gas);
        } else {
          const calcB = balancePreB.sub(gameAmount);
          const calcB1Gas = calcB.sub(gasCost);
          const calcB2Gas = calcB.sub(gasCost.mul(2));
          expect(balancePostB).gte(calcB2Gas).and.lte(calcB1Gas);
        }
      });
    });
    describe("Picking a winner", async function () {});
  });

  describe("Withdrawals", function () {
    // describe("Validations", function () {
    //   it("Should revert with the right error if called too soon", async function () {
    //     const { lock } = await loadFixture(deployLottery);
    //     await expect(lock.withdraw()).to.be.revertedWith(
    //       "You can't withdraw yet"
    //     );
    //   });
    //   it("Should revert with the right error if called from another account", async function () {
    //     const { lock, unlockTime, otherAccount } = await loadFixture(
    //       deployLottery
    //     );
    //     // We can increase the time in Hardhat Network
    //     await time.increaseTo(unlockTime);
    //     // We use lock.connect() to send a transaction from another account
    //     await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
    //       "You aren't the owner"
    //     );
    //   });
    //   it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
    //     const { lock, unlockTime } = await loadFixture(deployLottery);
    //     // Transactions are sent using the first signer by default
    //     await time.increaseTo(unlockTime);
    //     await expect(lock.withdraw()).not.to.be.reverted;
    //   });
    // });
    // describe("Events", function () {
    //   it("Should emit an event on withdrawals", async function () {
    //     const { lock, unlockTime, lockedAmount } = await loadFixture(
    //       deployLottery
    //     );
    //     await time.increaseTo(unlockTime);
    //     await expect(lock.withdraw())
    //       .to.emit(lock, "Withdrawal")
    //       .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
    //   });
    // });
    // describe("Transfers", function () {
    //   it("Should transfer the funds to the owner", async function () {
    //     const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
    //       deployLottery
    //     );
    //     await time.increaseTo(unlockTime);
    //     await expect(lock.withdraw()).to.changeEtherBalances(
    //       [owner, lock],
    //       [lockedAmount, -lockedAmount]
    //     );
    //   });
    // });
  });
});
