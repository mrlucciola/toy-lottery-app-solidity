// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract Lottery {
    // v2
    address public manager;
    // v2
    address payable public playerA;
    // v2
    address payable public playerB;
    // v1
    address payable[] public players;
    // v2
    uint256 public amount;
    // v2
    mapping(address => uint256) public balances;

    // event Withdrawal(uint256 amount, uint256 when);
    event Enter(uint256 amount, address player);

    constructor(uint256 _amount) {
        manager = address(msg.sender); // owner
        amount = _amount;
    }

    function getPlayers() public view returns (address payable[] memory) {
        return players;
    }

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
        require(msg.value == amount, "Insufficient funds ser");

        players.push(payable(address(msg.sender)));
    }

    function random() private view returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encodePacked(block.difficulty, block.timestamp, players)
                )
            );
    }

    /** PickWinner: Pick a winner and distribute
     * We use `restricted`: Manager should be the only one to call this
     */
    function pickWinner() public payable restricted {
        uint256 winnerIdx = random() % players.length;
        address winnerAddr = players[winnerIdx];

        payable(winnerAddr).transfer(address(this).balance);

        players = new address payable[](0);
    }

    /** Enter: Participate in lottery by sending ETH
     *
     * User sends the specified amount of ETH
     * User is included in the `players` array
     * Emit an event
     */
    function enter() public {
        // make sure player has enough ether
        require(address(msg.sender).balance >= amount, "Insufficient funds");
        // check if the game is full
        require(
            playerA != address(0x0) && playerB != address(0x0),
            "Game is full"
        );

        balances[address(msg.sender)] = amount;

        (bool sent, bytes memory _data) = payable(address(this)).call{
            value: amount
        }("");
        require(sent, "Failed to send eth");

        emit Enter(balances[msg.sender], address(msg.sender));
    }

    modifier restricted() {
        require(msg.sender == manager, "Must be manager");
        _;
    }
}
