// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "hardhat/console.sol";

contract Lottery {
    /// @notice The owner of the contract. The only user capable of advancing the stages of the lottery.
    /// @dev Need to create a setter to update the manager
    address public manager;

    /// @notice Array of payable addresses which indicate the active players in the current lottery iteration
    /// @dev This is currently set up to only handle 2 players
    address payable[] public players;

    /// @notice The contribution size (in ETH) each player must submit in order to participate
    /// @dev There is no setter for this variable.
    uint256 public amount;

    /// @notice Emit this event when player is added to the lottery
    event AddedPlayer(uint256 amount, address player);

    /// @notice Emit this event when lottery concludes
    event LotteryEnd(uint256 amount, address winner);

    /** Constructor
     *
     * Set the contract `manager`/owner via msg.sender
     * Set the lottery `amount`, the contribution size (in ETH) each player must submit in order to participate
     */
    constructor(uint256 _amount) {
        manager = address(msg.sender); // owner
        amount = _amount;
    }

    function getPlayers() public view returns (address payable[] memory) {
        return players;
    }

    /** Add Player: add a player to the lottery before drawing
     *
     * Performs checks:
     * - If game is fully subscribed
     * - If caller is currently participating
     * - If caller sends sufficient assets
     */
    function addPlayer() public payable {
        // check if game is full
        require(players.length < 2, "Game is full");

        // check if player is already entered
        if (players.length == 1) {
            require(
                players[0] != payable(msg.sender),
                "player is already entered"
            );
        }

        // send eth to contract
        require(msg.value == amount, "Insufficient funds");

        // add player to array
        players.push(payable(address(msg.sender)));

        emit AddedPlayer(amount, address(msg.sender));
    }

    /** Random: generate a pseudorandom number
     *
     * Not for production use.
     */
    function random() private view returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encodePacked(block.difficulty, block.timestamp, players)
                )
            );
    }

    /** Pick winner: Pick a winner and distribute
     * We use `restricted`: Manager should be the only one to call this
     *
     * Reset the `players` array to allow for another game.
     */
    function pickWinner() public payable restricted {
        // pick the winner using our RNG algo
        uint256 winnerIdx = random() % players.length;
        address winnerAddr = players[winnerIdx];

        // transfer ETH to winner
        payable(winnerAddr).transfer(address(this).balance);

        // reset players array
        players = new address payable[](0);

        // emit
        emit LotteryEnd(address(this).balance, winnerAddr);
    }

    /** Restricted: limit use to contract manager
     *
     * When this modifier is used, only the manager can call the function.
     * Used to prevent unauthorized users from calling sensitive functions
     */
    modifier restricted() {
        require(msg.sender == manager, "Must be manager");
        _;
    }
}
