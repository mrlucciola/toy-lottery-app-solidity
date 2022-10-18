import { BigNumber } from "ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// local
import { Lottery } from "../typechain-types";

interface Accts {
  [key: string]: SignerWithAddress;
}
let accts: Accts = {
  owner: {} as SignerWithAddress,
  a: {} as SignerWithAddress,
  b: {} as SignerWithAddress,
};
// let users = {
//   ctrc: { ctrc: {} as Lottery },
//   owner: { ctrc: {} as Lottery, acct: {} as SignerWithAddress },
//   a: { ctrc: {} as Lottery, acct: {} as SignerWithAddress },
//   b: { ctrc: {} as Lottery, acct: {} as SignerWithAddress },
// };
interface Contracts {
  [key: string]: Lottery;
}
let contracts: Contracts = {
  base: {} as Lottery,
  a: {} as Lottery,
  b: {} as Lottery,
};
let lottery: Lottery;
let gameAmount: BigNumber;
let balanceChangePost: Function;
describe("Lottery", async () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  before(async () => {
    // Contracts are deployed using the first signer/account by default
    const [owner, a, b] = await ethers.getSigners();
    accts = { owner, a, b };
    console.log("owner", owner.address);
    console.log("playerA", accts.a.address);
    console.log("playerB", accts.b.address);

    const Lottery = await ethers.getContractFactory("Lottery");

    gameAmount = ethers.utils.parseUnits("1.0", 18);
    lottery = await Lottery.deploy(gameAmount);
    contracts = {
      base: lottery,
      a: await lottery.connect(accts.a),
      b: await lottery.connect(accts.b),
    };
    balanceChangePost = async (
      addr: string,
      balancePre: BigNumber,
      expectedDiff: BigNumber,
      totalGasCost = BigNumber.from(0)
    ) => {
      const balancePost: BigNumber = await lottery.provider.getBalance(addr);
      const preCalc = balancePre.add(expectedDiff);
      if (totalGasCost.eq(0)) {
        expect(balancePost).to.equal(preCalc);
      } else {
        expect(balancePost).lte(preCalc).gte(preCalc.sub(totalGasCost));
      }
    };
  });

  describe("Deployment", async () => {
    it("Should set the right owner", async () => {
      expect(await lottery.manager()).to.equal(accts.owner.address);
    });

    it("Should return the right 'amount'", async () => {
      expect(await lottery.amount()).to.equal(gameAmount);
    });
  });

  describe("Lottery Actions", async () => {
    let gasPrice: BigNumber;
    let gasLimitAdd: BigNumber;
    let gasCost: BigNumber;
    let balancePreContract: BigNumber;
    let balancePreA: BigNumber;
    let balancePreB: BigNumber;
    let user: string;

    before(async () => {
      gasPrice = await lottery.provider.getGasPrice();
      gasLimitAdd = await lottery.estimateGas.addPlayer({
        value: gameAmount,
      });
      gasCost = gasLimitAdd.mul(gasPrice);
      balancePreContract = await lottery.provider.getBalance(lottery.address);
      balancePreA = await accts.a.getBalance();
      balancePreB = await accts.b.getBalance();
    });
    describe("Add Player A", async () => {
      before(async () => {
        user = "a";
      });
      it(`Add player and move funds`, async () => {
        const playersPre = await contracts[user].getPlayers();
        // should be 0
        expect(playersPre.length).to.equal(0);

        // make the call
        expect(
          await contracts[user].addPlayer({
            value: gameAmount,
            gasPrice,
            gasLimit: gasLimitAdd,
          })
        );
      });
      it(`Check state ∆`, async () => {
        // check
        const playersPost = await contracts[user].getPlayers();
        expect(playersPost.length).to.equal(1);
        expect(playersPost[0]).to.equal(
          await contracts[user].signer.getAddress()
        );
      });
      it(`Check balance ∆ - contract`, async () => {
        const addr = lottery.address;
        await balanceChangePost(addr, balancePreContract, gameAmount);
      });

      it(`Check balance ∆ - player A`, async () => {
        const acct = accts[user].address;
        await balanceChangePost(acct, balancePreA, gameAmount.mul(-1), gasCost);
      });
      it(`Fail to enter player A twice`, async () => {
        await expect(
          contracts[user].addPlayer({
            value: gameAmount,
            gasPrice,
            gasLimit: gasLimitAdd,
          })
        ).to.be.revertedWith("player is already entered");
      });
    });

    describe("Add Player B", async () => {
      before(async () => {
        user = "b";
      });
      it(`Add player & move funds`, async () => {
        const playersPre = await contracts[user].getPlayers();
        // should be 0
        expect(playersPre.length).to.equal(1);
        // make the call
        await expect(
          contracts[user].addPlayer({
            value: gameAmount,
            gasPrice,
            gasLimit: gasLimitAdd,
          })
        );
      });

      it(`Check state ∆`, async () => {
        // check
        const playersPost = await contracts[user].getPlayers();
        console.log("playerspost", playersPost);
        expect(playersPost.length).to.equal(2);
        expect(playersPost[0]).to.equal(await contracts.a.signer.getAddress());
        expect(playersPost[1]).to.equal(
          await contracts[user].signer.getAddress()
        );
      });

      it(`Check balance ∆ - contract`, async () => {
        const addr = lottery.address;
        await balanceChangePost(addr, balancePreContract, gameAmount.mul(2));
      });

      it(`Check balance ∆ - player`, async () => {
        let addr = accts[user].address;
        await balanceChangePost(addr, balancePreB, gameAmount.mul(-1), gasCost);
      });

      it(`Fail to enter player twice`, async () => {
        await expect(
          contracts[user].addPlayer({
            value: gameAmount,
            gasLimit: gasLimitAdd,
            gasPrice,
          })
        ).to.be.revertedWith("Game is full");
      });
    });

    // it("'Add player B': fail to enter player B twice", async () => {
    //   await expect(
    //     lotteryB.addPlayer({ value: gameAmount, gasLimit, gasPrice })
    //   ).to.be.revertedWith("Game is full");
    // });

    describe("Picking a winner", async () => {
      let gasCostPick: BigNumber;
      let gasLimitPick: BigNumber;
      before(async () => {
        gasLimitPick = await lottery.estimateGas.pickWinner({
          gasPrice,
        });
        gasCostPick = gasLimitPick.mul(gasPrice);
      });
      it("Should fail, unauthorized userA", async () => {
        await expect(
          contracts.a.pickWinner({
            gasLimit: gasLimitPick,
            gasPrice,
          })
        ).to.be.revertedWith("Must be manager");
      });
      it("Should fail, unauthorized userB", async () => {
        await expect(
          contracts.b.pickWinner({
            gasLimit: gasLimitPick,
            gasPrice,
          })
        ).to.be.revertedWith("Must be manager");
      });
      describe("Pick a winner", () => {
        before(async () => {
          // await contracts.base.pickWinner({
          //   gasLimit: gasLimitPick,
          //   gasPrice,
          // });
        });
        it("should be success", async () => {
          expect(
            await contracts.base.pickWinner({
              gasLimit: gasLimitPick,
              gasPrice,
            })
          );
        });

        it("Contract balance should be 0", async () => {
          const addr = contracts.base.address;
          const balancePost = await lottery.provider.getBalance(addr);
          expect(balancePost).to.equal(0);
        });
        it("Players array should be empty", async () => {
          const playersArr = await contracts.base.getPlayers();
          expect(playersArr.length).to.equal(0);
        });
        it("Winner should have a higher account balance", async () => {
          // need to use a better gas limit calc
  
          // const balancePostA = await lottery.provider.getBalance(accts.a.address);
          // const balancePostB = await lottery.provider.getBalance(accts.b.address);
          const balancePostA = await lottery.provider.getBalance(accts.a.address);
          const balancePostB = await lottery.provider.getBalance(accts.b.address);
  
          const isAwinner = balancePostA.gt(balancePostB);
          if (isAwinner) {
            console.log(
              "A is winner:",
              accts.a.address,
              balancePostA,
              await contracts.base.provider.getBalance(accts.a.address),
              await accts.a.getBalance()
            );
            const calcA = balancePreA.add(gameAmount);
            const calcA1Gas = calcA.sub(gasCost);
            const calcA2Gas = calcA.sub(gasCost.mul(2).add(gasCostPick));
  
            expect(balancePostA).gte(calcA2Gas).and.lte(calcA1Gas);
          } else {
            console.log(
              "B is winner:",
              accts.b.address,
              balancePostB,
              await contracts.base.provider.getBalance(accts.b.address),
              await accts.b.getBalance()
            );
            const calcB = balancePreB.add(gameAmount);
            const calcB1Gas = calcB.sub(gasCost);
            const calcB2Gas = calcB.sub(gasCost.mul(2).add(gasCostPick));
  
            expect(balancePostB).gte(calcB2Gas).and.lte(calcB1Gas);
          }
        });
        it("Loser should have a lower account balance", async () => {
          // need to use a better gas limit calc
          const balancePostA: BigNumber = await accts.a.getBalance();
          const balancePostB: BigNumber = await accts.b.getBalance();
  
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

    });
    // describe("Picking a winner", async  () {});
  });

  // describe("Withdrawals", function () {
  // describe("Validations", function () {
  //   it("Should revert with the right error if called too soon", async () => {
  //     const { lock } = await loadFixture(deployLottery);
  //     await expect(lock.withdraw()).to.be.revertedWith(
  //       "You can't withdraw yet"
  //     );
  //   });
  //   it("Should revert with the right error if called from another account", async () => {
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
  //   it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async () => {
  //     const { lock, unlockTime } = await loadFixture(deployLottery);
  //     // Transactions are sent using the first signer by default
  //     await time.increaseTo(unlockTime);
  //     await expect(lock.withdraw()).not.to.be.reverted;
  //   });
  // });
  // describe("Events", function () {
  //   it("Should emit an event on withdrawals", async () => {
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
  //   it("Should transfer the funds to the owner", async () => {
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
  // });
});
