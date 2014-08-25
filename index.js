var numPlayers = 3;

function Jackpot(startAmount, prizePercentage, winChanceFormula) {
  var betTotal        = 0; // Denormalized for convenience
  var highestTotalBet = 0;
  var userTotals      = {};

  // TODO: Should use 'x', not 'n'
  function relativeWinChance(n) {
    return eval(winChanceFormula);
  }

  function addBet(userId, amountInt) {
    var isNonZeroInt = amountInt % 1 === 0 && amountInt !== 0;
    if(typeof amountInt !== "number" || !isNonZeroInt) return;
    if(typeof userTotals[userId] !== "number")
      userTotals[userId] = 0;
    userTotals[userId] += amountInt;
    betTotal += amountInt;

    if(userTotals[userId] > highestTotalBet)
      highestTotalBet = userTotals[userId];
  }

  function getWinChance(userId) {
    var myWinChance    = 0.0;
    var totalWinChance = 0.0;

    // Iterate through object
    for (var id in userTotals) {
      var wc = relativeWinChance(userTotals[id]);
      console.log("Relative win chance: ", wc);
      totalWinChance += wc;
      if(id == userId)
        myWinChance = wc;
    }

    console.log("Getting winChance for player", userId, "RATIO", myWinChance, "/", totalWinChance);

    if(myWinChance === 0) return 0; // Avoid div by zero
    return myWinChance / totalWinChance;
  }

  function getBetAmount(userId) {
    var betAmount = 0;
    if(typeof userTotals[userId] === "number")
      betAmount = userTotals[userId];
    return betAmount;
  }

  function getROI(userId) {
    var betAmount = getBetAmount(userId);

    if(betAmount === 0) return 0;

    return (getWinChance(userId)*getPrizeAmount() - betAmount)/betAmount;
  }

  function getROIHypothetical(userId, amountIntAdded) {
    addBet(userId, amountIntAdded);    // Temporarily add bet
    var ROI_hypothetical = getROI(userId);
    addBet(userId, -1*amountIntAdded); // Remove bet

    console.log("Hyp ROI: ", ROI_hypothetical);
    return ROI_hypothetical;
  }

  function getPrizeAmount() {
    return (betTotal+startAmount)*prizePercentage;
  }

  // TODO: Keep in mind the house's cut
  function getNextJackpotSizeRatio() {
    return ((betTotal+startAmount) - getPrizeAmount()) / startAmount;
  }

  function getCallAmount(userId) {
    var increaseInt = highestTotalBet - getBetAmount(userId);
    return increaseInt;
  }

  function getRaiseAmount(userId, raiseAmountInt) {
    return getCallAmount(userId)+raiseAmountInt;
  }

  return {
    addBet                  : addBet,
    getCallAmount           : getCallAmount,
    getRaiseAmount          : getRaiseAmount,
    getPrizeAmount          : getPrizeAmount,
    getROI                  : getROI,
    getROIHypothetical      : getROIHypothetical,
    getNextJackpotSizeRatio : getNextJackpotSizeRatio
  };
}


var prizePercentage  = 0.5; // From 0-1
var startAmount      = 1000;
// var winChanceFormula = "n*(Math.log(n))";
var winChanceFormula = "n*n";

var jackpot = new Jackpot(startAmount, prizePercentage, winChanceFormula);

var keepLoopin = true;
while(keepLoopin) {
  var betsPlacedThisRound = 0;
  for(var userId = 1; userId <= numPlayers; userId++) {
    var playerName      = "player"+userId;

    var currentROI = jackpot.getROI(userId);
    var betAmount  = 0;

    var betAmountRaise = jackpot.getRaiseAmount(userId);
    var betAmountCall  = jackpot.getCallAmount(userId);
    var betAmountMin   = 1;
    var msg            = "SKIPPING";

    // Check RAISING the highest bet
    if(jackpot.getROIHypothetical(userId, betAmountRaise) > currentROI) {
      betAmount = betAmountRaise;
      msg = "RAISING";
    }
    // If not, check CALLING the highest bet
    else if(jackpot.getROIHypothetical(userId, betAmountCall) > currentROI) {
      betAmount = betAmountCall;
      msg = "CALLING";
    }
    else if(jackpot.getROIHypothetical(userId, betAmountMin) > currentROI) {
      betAmount = betAmountMin;
      msg = "PLACING MIN BET";
    }

    console.log(playerName, msg, betAmount);
    if(betAmount > 0) {
      betsPlacedThisRound++;
      jackpot.addBet(userId, betAmount);
    }
  }
  console.log("NEXT JACKPOT SIZE RATIO: ", jackpot.getNextJackpotSizeRatio());

  if(jackpot.getNextJackpotSizeRatio() > 20) {
    keepLoopin = false;
    console.log("Stopping loop because next jackpot grew too much...");
  }
  if(betsPlacedThisRound === 0) {
    keepLoopin = false;
    console.log("Stopping loop because no bets placed this round.");
  }
}
