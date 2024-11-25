const crypto = require("crypto");
const readline = require("readline");

// --- Class Definitions ---

class Dice {
  constructor(faces) {
    if (faces.length !== 6 || !faces.every(Number.isInteger)) {
      throw new Error("Each dice must have exactly 6 integers.");
    }
    this.faces = faces;
  }

  roll(index) {
    return this.faces[index];
  }

  toString() {
    return `[${this.faces.join(",")}]`;
  }
}

class InputParser {
  static parseDiceConfigs(args) {
    if (args.length < 3) {
      throw new Error("You must specify at least 3 dice configurations.");
    }
    return args.map((arg) => new Dice(arg.split(",").map(Number)));
  }
}

class ProbabilityCalculator {
  static calculateProbability(diceA, diceB) {
    let count = 0;
    for (let a of diceA) {
      for (let b of diceB) {
        if (a > b) {
          count++;
        }
      }
    }
    const totalOutcomes = 36;
    const probability = count / totalOutcomes;
    return Number(probability.toFixed(4));
  }
  static calculate(diceSet) {
    console.log(diceSet[0].faces, "diceSet");
    const probabilities = [];
    for (let i = 0; i < diceSet.length; i++) {
      probabilities[i] = [];
      for (let j = 0; j < diceSet.length; j++) {
        if (i === j) {
          probabilities[i][j] = "- (0.3333)";
        } else {
          probabilities[i][j] = this.calculateProbability(
            diceSet[i].faces,
            diceSet[j].faces
          );
        }
      }
    }
    return probabilities;
  }

  static display(probabilities, diceConfigs) {
    console.log("\nProbability of the win for the user:");
    console.log(
      "+--------------+" + diceConfigs.map(() => "--------------+").join("")
    );
    console.log(
      "| User dice v | " +
        diceConfigs
          .map((dice) => dice.toString().padEnd(11, " ") + " |")
          .join("")
    );
    console.log(
      "+--------------+" + diceConfigs.map(() => "--------------+").join("")
    );
    probabilities.forEach((row, i) => {
      console.log(
        "| " +
          diceConfigs[i].toString().padEnd(11, " ") +
          " | " +
          row.map((p) => p.toString().padEnd(11, " ")).join(" | ") +
          " |"
      );
      console.log(
        "+--------------+" + diceConfigs.map(() => "--------------+").join("")
      );
    });
  }

  static showResults() {
    const args = process.argv.slice(2);
    const diceSet = InputParser.parseDiceConfigs(args);
    // console.log(args, "args", diceSet, "dice set");
    const probabilities = this.calculate(diceSet);
    this.display(probabilities, diceSet);
  }
}

class FairRandomGenerator {
  static generateRandom(range) {
    const key = crypto.randomBytes(32).toString("hex");
    const randomValue = crypto.randomInt(0, range);
    const hmac = crypto
      .createHmac("sha3-256", key)
      .update(randomValue.toString())
      .digest("hex");
    return { randomValue, hmac, key };
  }

  static verifyHMAC(value, key, hmac) {
    const calculatedHMAC = crypto
      .createHmac("sha3-256", key)
      .update(value.toString())
      .digest("hex");
    return hmac === calculatedHMAC;
  }
}

class Game {
  constructor(diceSet) {
    this.diceSet = diceSet;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start() {
    console.log("Welcome to the Dice Game!");
    await this.determineFirstMove();

    let userDice, computerDice;
    [userDice, computerDice] = await this.selectDice();

    await this.performThrow(userDice, computerDice);
    this.rl.close();
  }

  async determineFirstMove() {
    console.log("\nDetermining who makes the first move...");
    const { randomValue, hmac, key } = FairRandomGenerator.generateRandom(2);
    console.log(`I selected a random value in the range 0..1 (HMAC=${hmac}).`);

    const userChoice = await this.prompt(
      "Try to guess my selection (0 or 1): "
    );
    const computerChoice = randomValue;

    console.log(`My selection: ${computerChoice} (KEY=${key}).`);

    if (parseInt(userChoice, 10) === computerChoice) {
      console.log("You guessed it! You make the first move.");
      this.firstMove = "user";
    } else {
      console.log("I make the first move.");
      this.firstMove = "computer";
    }
  }

  async selectDice() {
    console.log("\nChoose your dice:");
    this.diceSet.forEach((dice, index) => console.log(`${index} - ${dice}`));

    const userChoice = await this.prompt("Your selection: ");
    const userDice = this.diceSet.splice(userChoice, 1)[0];

    const computerDice = this.diceSet.splice(0, 1)[0]; // Computer picks the first remaining dice
    console.log(`I choose the ${computerDice}.`);
    return [userDice, computerDice];
  }

  async performThrow(userDice, computerDice) {
    console.log("\nIt's time for the throws!");

    // Computer's throw
    const computerRoll = await this.fairThrow(6, "computer");

    // User's throw
    const userRoll = await this.fairThrow(6, "user");

    // Display results
    console.log(`\nMy throw is ${computerDice.roll(computerRoll)}.`);
    console.log(`Your throw is ${userDice.roll(userRoll)}.`);

    // Determine winner
    if (computerDice.roll(computerRoll) > userDice.roll(userRoll)) {
      console.log("I win!");
    } else if (computerDice.roll(computerRoll) < userDice.roll(userRoll)) {
      console.log("You win!");
    } else {
      console.log("It's a draw!");
    }
  }

  async fairThrow(range, player) {
    const { randomValue, hmac, key } =
      FairRandomGenerator.generateRandom(range);
    console.log(
      `I selected a random value in the range 0..${
        range - 1
      } (HMAC=${hmac}). \nYour selection: \n0 - 0\n1 - 1\n2 - 2\n3 - 3\n4 - 4\n5 - 5\nX - exit\n? - help\n`
    );

    let userNumber = await this.prompt(`Add your number modulo ${range}: `);
    // if x quit
    if (userNumber === "x" || userNumber === "X") {
      process.exit(1);
    }
    if (userNumber === "?") {
      ProbabilityCalculator.showResults();
      return this.fairThrow(range, player);
    }
    // if ? display win probabilities
    const result = (randomValue + parseInt(userNumber, 10)) % range;
    console.log(
      `${
        player === "user" ? "My" : "Your"
      } number is ${randomValue} (KEY=${key}).`
    );
    console.log(
      `The result is ${(randomValue + parseInt(userNumber, 10)) % range}.`
    );
    return result;
  }

  prompt(question) {
    return new Promise((resolve) =>
      this.rl.question(question, (answer) => resolve(answer))
    );
  }
}

// --- Main Program ---
// add line with possibilities 1,2,3... help, x
// add functions for quitting and displaying winning probabilities

try {
  const args = process.argv.slice(2);
  const diceSet = InputParser.parseDiceConfigs(args);
  // console.log(args, "args", diceSet, "dice set");
  // const probabilities = ProbabilityCalculator.calculate(diceSet);
  // ProbabilityCalculator.display(probabilities, diceSet);
  ProbabilityCalculator.showResults();

  const game = new Game(diceSet);
  game.start();
} catch (error) {
  console.error("Error:", error.message);
  console.error(
    "Example usage: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3"
  );
  process.exit(1);
}
