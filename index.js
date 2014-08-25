Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};

var numPlayers = 20;

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
      totalWinChance += wc;
      if(id == userId)
        myWinChance = wc;
    }

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

// var prizePercentage  = 0.64; // From 0-1
var prizePercentage  = 0.6; // From 0-1
var startAmount      = 1000;
var winChanceFormula = "n*n";

var jackpot    = new Jackpot(startAmount, prizePercentage, winChanceFormula);
var keepLoopin = true;

var getROIRange = function(betRange) {
  return betRange.map(function(betAmount) {
    return jackpot.getROIHypothetical(userId, betAmount);
  });
};

while(keepLoopin) {
  var betsPlacedThisRound = 0;
  for(var userId = 1; userId <= numPlayers; userId++)
  {
    var playerName = "player"+userId;

    var currentROI = jackpot.getROI(userId);
    var betAmount  = 0;

    ////////////////////////////////////////////////////////////////
    // Try and find an optimal bet for player.  Narrow in on it, binary-search
    // style.
    //
    // Beware that this binary-style search assumes that a curve of bets will
    // progress smoothly from high to low or low to high chances, and this isn't
    // necessarily true.  But should get us started.
    //
    // Minimum, Maximum
    // Maximum is now chosen based on 2x prize amount.  Maximum bet may lay outside of that.
    var betRange = [1, jackpot.getPrizeAmount()*2];
    var bestBet  = 0;

    while(betRange[1] - betRange[0] > 1) {
      var midPointBet    = Math.floor((betRange[0]+betRange[1])/2);
      var ROIRange       = getROIRange(betRange);
      var indexToReplace = ROIRange.indexOf(ROIRange.min());
      betRange[indexToReplace] = midPointBet;
    }

    ////////////////
    // Get the best bet out of the two in the range.
    var ROIRange    = getROIRange(betRange);
    var maxROI      = ROIRange.max();
    var maxROIIndex = ROIRange.indexOf(maxROI);
    var bestBet     = betRange[maxROIIndex];

    if(maxROI > currentROI && maxROI > 0) {
      jackpot.addBet(userId, bestBet);
      betsPlacedThisRound++;
       console.log(playerName, "adding bet: ", bestBet);
    }
    else {
      console.log(playerName, "NOT adding bet.");
    }
  }

  console.log("NEXT JACKPOT SIZE RATIO: ", jackpot.getNextJackpotSizeRatio());

  var stopReason;
  if(jackpot.getNextJackpotSizeRatio() > 20) {
    keepLoopin = false;
    stopReason = "next jackpot grew too much...";
  }
  else if(betsPlacedThisRound === 0) {
    keepLoopin = false;
    stopReason = "no bets placed this round.";
  }
  if(!keepLoopin)
    console.log("Stopping gameplay because ", stopReason);
}
