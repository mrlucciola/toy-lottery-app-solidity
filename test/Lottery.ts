import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Lottery } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

let lotteryContract: Lottery;
let lottery: Lottery;
let owner: SignerWithAddress;
let playerA: SignerWithAddress;
let playerB: SignerWithAddress;
let lotteryA: Lottery;
let lotteryB: Lottery;
let gameAmount: BigNumber;

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
  });
  async function deployLottery() {
    // // Contracts are deployed using the first signer/account by default
    // const [owner, playerA, playerB] = await ethers.getSigners();
    // const Lottery = await ethers.getContractFactory("Lottery");
    // const gameAmount = ethers.utils.parseUnits("1.0", 18);
    // const lottery = await Lottery.deploy(gameAmount);
    // return { lottery, gameAmount, owner, playerA, playerB };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await lottery.manager()).to.equal(owner.address);
    });

    it("Should return the right 'amount'", async function () {
      expect(await lottery.amount()).to.equal(gameAmount);
    });
  });

  describe("Lottery Actions", async () => {
    it("Should add player A and move funds", async function () {
      await lotteryA.addPlayer({ value: ethers.utils.parseEther("1") });
      expect((await lottery.getPlayers()).length).to.equal(1);
      expect((await lottery.getPlayers())[0]).to.equal(
        await lotteryA.signer.getAddress()
      );
    });
    it("Should fail enter player A twice", async () => {
      await expect(
        lotteryA.addPlayer({ value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("player is already entered");
    });

    it("Should add player B and move funds", async function () {
      await lotteryB.addPlayer({ value: ethers.utils.parseEther("1") });
      expect((await lottery.getPlayers()).length).to.equal(2);
      expect((await lottery.getPlayers())[1]).to.equal(
        await lotteryB.signer.getAddress()
      );
    });
    it("Should fail enter player B twice", async () => {
      await expect(
        lotteryA.addPlayer({ value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("player is already entered");
    });

    it("Should pick a winner", async () => {
      await lottery.pickWinner();
    });
    it("Player array should be empty", async () => {
      expect((await lottery.getPlayers()).length).to.equal(0);
    });

    it("Winner should have a higher account balance", async () => {
      // const winner = 
      // expect((await lottery.getPlayers()).length).to.equal(0);
    });
    it("Loser should have a lower account balance", async () => {
      // expect((await lottery.getPlayers()).length).to.equal(0);
    });
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
