Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};


function Jackpot(startAmount, prizePercentage, calculateRelativeWinChanceFn) {
  var betTotal        = 0; // Denormalized for convenience
  var highestTotalBet = 0;
  var userTotals      = {};

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

    // Iterate through all user totals
    for (var id in userTotals) {
      var wc = calculateRelativeWinChanceFn(userTotals[id]);
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
    var ROIHypothetical = getROI(userId);
    addBet(userId, -1*amountIntAdded); // Remove bet
    return ROIHypothetical;
  }

  function getPrizeAmount() {
    return Math.ceil((betTotal+startAmount)*prizePercentage);
  }

  // TODO: Keep in mind the house's cut
  function getNextJackpotSizeRatio() {
    return ((betTotal+startAmount) - getPrizeAmount()) / startAmount;
  }

  return {
    addBet                  : addBet,
    getPrizeAmount          : getPrizeAmount,
    getROI                  : getROI,
    getROIHypothetical      : getROIHypothetical,
    getNextJackpotSizeRatio : getNextJackpotSizeRatio
  };
}

function runSimulation(
  numPlayers, startAmount, prizePercentage, winChanceFormula, suppressOutput)
{
  if(typeof suppressOutput === "undefined") {
    suppressOutput = false;
  }
  function output() {
    if(!suppressOutput) console.log.apply(this, arguments);
  }

  var keepLoopin = true;
  var jackpot    = new Jackpot(startAmount, prizePercentage, winChanceFormula);

  var getROIRange = function(betRange) {
    return betRange.map(function(betAmount) {
      return jackpot.getROIHypothetical(userId, betAmount);
    });
  };

  while(keepLoopin)
  {
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
      // Minimum, Maximum.  Maximum bet is now chosen based on 2x prize amount.
      // The optimal bet may lay outside of that range.
      //
      // Also, beware that ROI can be different from making as much money as
      // possible.
      //
      // For example, these 'rational' players will currently, sometimes, bet 1
      // satoshis instead of 2, which will increase their theoretical ROI but
      // will not lead to, on average, making more money.
      //
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

      output(playerName, "maxROI: ", maxROI);
      if(maxROI > currentROI && maxROI > 0) {
        jackpot.addBet(userId, bestBet);
        betsPlacedThisRound++;
        output(playerName, "adding bet: ", bestBet);
      }
      else {
        output(playerName, "NOT adding bet.");
      }
    }

    output("NEXT JACKPOT SIZE RATIO: ", jackpot.getNextJackpotSizeRatio());

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
      output("Stopping gameplay because ", stopReason);
  }
  return jackpot.getNextJackpotSizeRatio();
}

var numPlayers       = 20;
var prizePercentage  = 0.6; // From 0-1
var startAmount      = 1000;
var winChanceFn      = function(x) { return x*x; };



////////////////////////////////////////////////////////////////
// Simulation of different incentive schemes
//
var suppressOutput        = true;
var numPlayersValues      = [2, 3, 6, 50];
var prizePercentageValues = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];

var prizePercentage, numPlayers, jackpotSizeRatio;
for(var jj = 0; jj < prizePercentageValues.length; jj++)
{
  prizePercentage = prizePercentageValues[jj];
  console.log("==============================================");
  console.log("-------------- PRIZE PERCENTAGE: "+prizePercentage+" ---------");
  console.log("==============================================");

  for(var ii = 0; ii < numPlayersValues.length; ii++) {
    numPlayers       = numPlayersValues[ii];
    jackpotSizeRatio =
      runSimulation(numPlayers, startAmount, prizePercentage, winChanceFn, suppressOutput);

    console.log("| NUMPLAYERS:", numPlayers);
    console.log("| ---------------");
    console.log("| NEXT_JACKPOT RATIO:", jackpotSizeRatio);
    console.log("| ");
  }
  console.log("| ");
}
