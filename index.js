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

    for (var id in userTotals) {
      var wc = calculateRelativeWinChanceFn(userTotals[id]);
      totalWinChance += wc;
      if(id == userId)
        myWinChance = wc;
    }

    if(myWinChance === 0) return 0; // Avoid division by zero
    return myWinChance / totalWinChance;
  }

  function getBetAmount(userId) {
    var betAmount = 0;
    if(typeof userTotals[userId] === "number")
      betAmount = userTotals[userId];
    return betAmount;
  }

  function getAvgWinnings(userId) {
    if(getBetAmount(userId) === 0) return 0;
    return getWinChance(userId)*getPrizeAmount() - getBetAmount(userId);
  }
  function getAvgROI(userId) {
    if(getBetAmount(userId) === 0) return 0;
    return getAvgWinnings(userId)/getBetAmount(userId);
  }

  function getAvgROIIfAdd(userId, amountIntAdded) {
    return getAvgIfAdd(userId, amountIntAdded, true);
  }
  function getAvgWinningsIfAdd(userId, amountIntAdded) {
    return getAvgIfAdd(userId, amountIntAdded, false);
  }
  function getAvgIfAdd(userId, amountIntAdded, isROI) {
    // Temporarily add bet
    addBet(userId, amountIntAdded);

    var avg;
    if(isROI) { avg = getAvgROI(userId); }
    else { avg = getAvgWinnings(userId); }

    // Remove bet
    addBet(userId, -1*amountIntAdded);
    return avg;
  }

  function getPrizeAmount() {
    return Math.ceil((betTotal+startAmount)*prizePercentage);
  }

  // TODO: Keep in mind the house's cut
  function getThisJackpotToNextJackpotSizeRatio() {
    return ((betTotal+startAmount) - getPrizeAmount()) / startAmount;
  }

  return {
    addBet                               : addBet,
    getPrizeAmount                       : getPrizeAmount,
    getAvgROI                            : getAvgROI,
    getAvgROIIfAdd                       : getAvgROIIfAdd,
    getAvgWinnings                       : getAvgWinnings,
    getAvgWinningsIfAdd                  : getAvgWinningsIfAdd,
    getThisJackpotToNextJackpotSizeRatio : getThisJackpotToNextJackpotSizeRatio
  };
}

function runSimulation(
  numPlayers, startAmount, prizePercentage, winChanceFormula,
  playersMaximizeROIOverWinnings, suppressOutput)
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
      if(playersMaximizeROIOverWinnings) {
        return jackpot.getAvgROIIfAdd(userId, betAmount);
      }
      return jackpot.getAvgWinningsIfAdd(userId, betAmount);
    });
  };

  while(keepLoopin)
  {
    var betsPlacedThisRound = 0;
    for(var userId = 1; userId <= numPlayers; userId++)
    {
      var playerName = "player"+userId;

      var currentROI;
      if(playersMaximizeROIOverWinnings) {
        currentROI = jackpot.getAvgROI(userId);
      }
      else {
        currentROI = jackpot.getAvgWinnings(userId, betAmount);
      }

      var betAmount  = 0;

      ////////////////////////////////////////////////////////////////
      // Try and find an optimal bet for player.  Narrow in on it, binary-search
      // style.
      //
      // Beware that this binary-style search assumes that a curve of bets will
      // progress smoothly from high to low or low to high chances, and this
      // isn't necessarily true.  But should get us started.
      //
      // Minimum, Maximum.  Maximum bet is now chosen based on 2x prize amount.
      // The optimal bet may lay outside of that range.
      //
      // Also, beware that ROI can be different from making as much money as
      // possible.
      //
      // For example, these 'rational' players will currently, sometimes, bet 1
      // satoshis instead of 2, which will keep them at a higher percentage ROI
      // but will lead to, on average, making less money.
      //
      //
      // We could have 2 types of players (separate or mixed in the simulation):
      //
      // X -- Ones who try to optimize for percentage won.
      // X -- Ones who try to optimize for money won.
      //
      var betRange = [1, jackpot.getPrizeAmount()*2];
      while(true) {
        var midPointBet    = Math.floor((betRange[0]+betRange[1])/2);
        var ROIRange       = getROIRange(betRange);
        var indexToReplace = ROIRange.indexOf(ROIRange.min());

        if(betRange[indexToReplace] === midPointBet) break;

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

    output("NEXT JACKPOT SIZE RATIO: ", jackpot.getThisJackpotToNextJackpotSizeRatio());

    var stopReason;
    if(jackpot.getThisJackpotToNextJackpotSizeRatio() > 20) {
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
  return jackpot.getThisJackpotToNextJackpotSizeRatio();
}


////////////////////////////////////////////////////////////////
// Simulation of different incentive schemes
//
var winChanceFn           =
  function(x) { return Math.pow(x, 2);};
var startAmount           = 1000;
var suppressOutput        = true;
var numPlayersValues      = [2, 3, 6, 50, 200];
var prizePercentageValues = [0.4, 0.5, 0.6, 0.65, 0.7, 0.8, 0.9, 0.95];

var prizePercentage, numPlayers, jackpotSizeRatio;
for(var jj = 0; jj < prizePercentageValues.length; jj++)
{
  prizePercentage = prizePercentageValues[jj];
  console.log("==============================================");
  console.log("-------------- PRIZE PERCENTAGE: "+prizePercentage+" ---------");
  console.log("==============================================");

  for(var ii = 0; ii < numPlayersValues.length; ii++) {
    numPlayers       = numPlayersValues[ii];

    console.log("| NUMPLAYERS:", numPlayers);
    console.log("| ---------------");

    var pursueWhat = [{pursueROI: true,  text: "  ROI   "},
                      {pursueROI: false, text: "WINNINGS"}];

    for(var kk = 0; kk < pursueWhat.length; kk++)
    {
      var obj = pursueWhat[kk];
      jackpotSizeRatio = runSimulation(numPlayers, startAmount, prizePercentage, winChanceFn, obj.pursueROI, suppressOutput);

      console.log("| NEXT_JACKPOT RATIO ("+obj.text+"):", jackpotSizeRatio);
    }
    console.log("| ");
  }
  console.log("| ");
}
