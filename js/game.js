/**
 * Copper Trader - Game Logic
 * A 10-year copper trading simulation game
 */

(function() {
  // ===== Firebase =====
  let db = null;
  try {
    if (typeof firebase !== 'undefined') {
      db = firebase.firestore();
    }
  } catch (e) {
    // Firebase initialization failed
  }

  // ===== Constants =====
  const YEARS = 10;
  const INTEREST = 10;
  const LINE_OF_CREDIT = 200;
  const R = INTEREST / 100;

  // ===== Fixed Market Path ($/lb) - $3-$10 range =====
  const FIXED_PRICES = [
    { year: 1,  spot: 4.00, next: 4.60 },  // +15% contango
    { year: 2,  spot: 4.60, next: 5.00 },  // +8.7% backwardation
    { year: 3,  spot: 5.00, next: 4.40 },  // -12% backwardation
    { year: 4,  spot: 4.40, next: 5.00 },  // +13.6% contango
    { year: 5,  spot: 5.00, next: 5.60 },  // +12% contango
    { year: 6,  spot: 5.60, next: 6.00 },  // +7.1% backwardation
    { year: 7,  spot: 6.00, next: 6.40 },  // +6.7% backwardation
    { year: 8,  spot: 6.40, next: 6.80 },  // +6.3% backwardation
    { year: 9,  spot: 6.80, next: 7.60 },  // +11.8% contango
    { year: 10, spot: 7.60, next: 7.00 }   // -7.9% backwardation
  ];

  function generateMarketPath() {
    return FIXED_PRICES.map(p => ({
      year: p.year,
      spot: p.spot,
      next: p.next,
      carry: (p.next / p.spot) - 1
    }));
  }

  // ===== State =====
  let MARKET = [];
  let S = {
    year: 1,
    cash: 0,
    loans: 0,
    lbs: 0,
    spot: 4.00,
    over: false,
    loans_beg: 0,
    negEquityStreak: 0,
    prevNW: 0,
    negativeCount: 0
  };

  // ===== Timer =====
  let timerStart = null;
  let timerInterval = null;
  let finalTime = 0;

  function startTimer() {
    timerStart = Date.now();
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    finalTime = timerStart ? Math.floor((Date.now() - timerStart) / 1000) : 0;
    return finalTime;
  }

  function updateTimerDisplay() {
    if (!timerStart) return;
    const elapsed = Math.floor((Date.now() - timerStart) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    document.getElementById('timer').textContent =
      String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  // ===== Helpers =====
  const toInt = n => Math.max(0, Math.floor(Number(n) || 0));
  const toNum = n => Math.max(0, Number(n) || 0);
  const roundMoney = n => Math.round(n * 100) / 100;

  const intv = x => {
    const result = roundMoney(x * INTEREST / 100);
    console.log('intv(' + x + ') =', result);
    return result;
  };

  const nwStart = () => {
    const copperValue = S.lbs * S.spot;
    const assets = S.cash + copperValue;
    const interestDue = intv(S.loans_beg);
    const liabilities = S.loans + interestDue;
    const nw = roundMoney(assets - liabilities);
    console.log('nwStart: assets(' + roundMoney(assets) + ') - liabilities(' + roundMoney(liabilities) + ') =', nw);
    return nw;
  };

  const nwAfter = () => roundMoney((S.cash + S.lbs * S.spot) - S.loans);

  const credit = () => {
    const nw = nwStart();
    const creditLimit = roundMoney(LINE_OF_CREDIT + nw);
    console.log('credit: LINE_OF_CREDIT(' + LINE_OF_CREDIT + ') + nwStart(' + nw + ') =', creditLimit);
    return creditLimit;
  };

  const fmt = n => {
    const v = Number(n);
    if (Number.isInteger(v)) return String(v);
    const rounded = Math.round(v * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  };

  const fmtInt = n => String(Math.max(0, Math.floor(Number(n) || 0)));

  function showError(t) {
    const box = document.getElementById('errorBanner');
    if (!t) {
      box.classList.remove('visible');
      box.textContent = '';
    } else {
      box.classList.add('visible');
      box.textContent = t;
    }
  }

  function showMessage(type, title, detail) {
    const content = document.getElementById('messageContent');
    const titleEl = document.getElementById('messageTitle');
    const detailEl = document.getElementById('messageDetail');

    content.classList.remove('positive', 'negative', 'danger');

    if (!type) {
      titleEl.textContent = 'Nothing to report.';
      detailEl.textContent = '';
      return;
    }

    content.classList.add(type);
    titleEl.textContent = title;
    detailEl.textContent = detail || '';
  }

  function updateAmountPrice() {
    const amt = Number(document.getElementById('copperAmount').value || 0);
    const spot = S.spot;
    const total = amt * spot;
    document.getElementById('amountPrice').textContent = '= $' + (isFinite(total) ? fmt(total) : '0');
  }

  function updateCreditLimit() {
    const creditVal = credit();
    const available = Math.max(0, creditVal - S.loans);
    console.log('updateCreditLimit: credit()=' + creditVal + ', S.loans=' + S.loans + ', available=' + available + ', displayed=' + fmt(available));
    document.getElementById('creditLimit').textContent = fmt(available);
  }

  function render() {
    document.getElementById('yearBadge').textContent = `Year ${S.year} of 10`;
    document.getElementById('actYear').textContent = S.year;
    document.getElementById('cash').textContent = fmt(S.cash);
    document.getElementById('valCopper').textContent = fmt(S.lbs * S.spot);
    document.getElementById('loans').textContent = fmt(S.loans);
    document.getElementById('intPay').textContent = fmt(intv(S.loans_beg));

    const nw = nwStart();
    const nwEl = document.getElementById('netWorth');
    nwEl.textContent = '$' + fmt(Math.abs(nw));
    if (nw < 0) {
      nwEl.textContent = '-$' + fmt(Math.abs(nw));
      nwEl.classList.add('negative');
    } else {
      nwEl.classList.remove('negative');
    }

    document.getElementById('lbs').textContent = fmtInt(S.lbs);
    document.getElementById('spot').textContent = fmt(S.spot);

    if (MARKET.length >= S.year) {
      document.getElementById('fwd').textContent = fmt(MARKET[S.year - 1].next);
    }

    updateAmountPrice();
    updateCreditLimit();
  }

  function showGameover(title, isWin) {
    document.getElementById('main').classList.add('hidden');
    document.getElementById('gameover').classList.remove('hidden');
    const titleEl = document.getElementById('gameoverTitle');
    titleEl.textContent = title;
    titleEl.className = 'gameover-title ' + (isWin ? 'win' : 'lose');
  }

  // ===== PAR uses same MARKET path =====
  function simulatePar() {
    const path = MARKET;

    function clone() {
      return { year: 1, cash: 0, loans: 0, lbs: 0, loans_beg: 0 };
    }

    function interestDue(lb) {
      return lb * (INTEREST / 100);
    }

    function nwS(s) {
      const spot = path[s.year - 1].spot;
      return (s.cash + s.lbs * spot) - (s.loans + interestDue(s.loans_beg));
    }

    function creditS(s) {
      return LINE_OF_CREDIT + nwS(s);
    }

    function step(st) {
      const tl = [];
      while (st.year <= YEARS) {
        const pr = path[st.year - 1];
        const spot = pr.spot, next = pr.next, carry = pr.carry;
        const regime = carry > R + 1e-9 ? 'contango' : (carry < R - 1e-9 ? 'backwardation' : 'neutral');
        const intThis = interestDue(st.loans_beg);
        let didBorrow = 0, didBuy = 0, didSell = 0, didRepay = 0;

        if (regime === 'contango') {
          let limit = Math.max(0, creditS(st) - st.loans);
          let needInt = Math.max(0, intThis - st.cash);
          let b1 = Math.min(needInt, limit);
          if (b1 > 0) { st.loans += b1; st.cash += b1; didBorrow += b1; limit -= b1; }
          let buyBudget = Math.max(0, st.cash - intThis) + limit;
          let maxBuy = Math.floor(buyBudget / spot);
          if (maxBuy > 0) {
            let shortfall = Math.max(0, maxBuy * spot - Math.max(0, st.cash - intThis));
            let b2 = Math.min(shortfall, limit);
            if (b2 > 0) { st.loans += b2; st.cash += b2; didBorrow += b2; limit -= b2; }
            let execBuy = Math.floor(Math.max(0, st.cash - intThis) / spot);
            execBuy = Math.min(execBuy, maxBuy);
            if (execBuy > 0) { st.lbs += execBuy; st.cash -= execBuy * spot; didBuy += execBuy; }
          }
        } else if (regime === 'backwardation') {
          if (st.lbs > 0) { didSell = st.lbs; st.cash += st.lbs * spot; st.lbs = 0; }
          if (st.cash > 0 && st.loans > 0) { didRepay = Math.min(st.cash, st.loans); st.loans -= didRepay; st.cash -= didRepay; }
        }

        if (st.cash < intThis) {
          const need = intThis - st.cash;
          const extraSell = Math.min(Math.ceil(need / spot), st.lbs);
          if (extraSell > 0) { didSell += extraSell; st.lbs -= extraSell; st.cash += extraSell * spot; }
        }

        if (st.cash < intThis) { return { score: -Infinity, timeline: [] }; }
        st.cash -= intThis;
        tl.push({
          year: st.year,
          regime,
          spot: spot,
          next: next,
          borrow: didBorrow,
          buy: didBuy,
          sell: didSell,
          repay: didRepay,
          interest: intThis,
          cash: st.cash,
          loans: st.loans,
          lbs: st.lbs
        });
        st.year += 1;
        st.loans_beg = st.loans;
      }
      const lastNext = path[YEARS - 1].next;
      return { score: (st.cash + st.lbs * lastNext) - st.loans, timeline: tl };
    }

    const best = step(clone());
    if (!Number.isFinite(best.score) || best.score <= 0) { best.score = 1; }
    return best;
  }

  let PAR = null;

  function processTurn() {
    try {
      // Prevent processing if game is already over
      if (S.over) return;

      showError('');
      const prevNW = S.prevNW;
      const intThis = intv(S.loans_beg);
      const copperAction = (document.querySelector('input[name="copperAction"]:checked') || { value: 'buy' }).value;
      const loanAction = (document.querySelector('input[name="loanAction"]:checked') || { value: 'borrow' }).value;
      const copperAmt = toInt(document.getElementById('copperAmount').value);
      const loanAmt = toNum(document.getElementById('loanAmount').value);

      if (Number.isNaN(copperAmt) || Number.isNaN(loanAmt)) {
        showError('Invalid input.');
        return;
      }

      if (loanAction === 'borrow' && loanAmt > 0) {
        console.log('=== BORROW VALIDATION DEBUG ===');
        console.log('Current state:');
        console.log('  S.cash:', S.cash);
        console.log('  S.loans:', S.loans);
        console.log('  S.lbs:', S.lbs);
        console.log('  S.spot:', S.spot);
        console.log('  S.loans_beg:', S.loans_beg);

        console.log('Calculations:');
        console.log('  Copper value (S.lbs * S.spot):', S.lbs * S.spot);
        const creditVal = credit();
        const availableCredit = creditVal - S.loans;
        console.log('  Available credit (credit() - S.loans):', availableCredit);

        const lim = roundMoney(Math.max(0, availableCredit));
        const roundedLoanAmt = roundMoney(loanAmt);
        console.log('  lim (after roundMoney & Math.max):', lim);
        console.log('  loanAmt requested:', loanAmt);
        console.log('  roundedLoanAmt:', roundedLoanAmt);
        console.log('  roundedLoanAmt > lim + 0.01?', roundedLoanAmt > lim + 0.01);
        console.log('  Difference (roundedLoanAmt - lim):', roundedLoanAmt - lim);

        // Use epsilon tolerance for comparison
        if (roundedLoanAmt > lim + 0.01) {
          console.log('>>> REJECTED: roundedLoanAmt > lim + 0.01');
          showError('Borrow exceeds credit limit.');
          return;
        }
        console.log('>>> APPROVED: Proceeding with borrow');
        S.loans = roundMoney(S.loans + roundedLoanAmt);
        S.cash = roundMoney(S.cash + roundedLoanAmt);
        console.log('After borrow - S.loans:', S.loans, 'S.cash:', S.cash);
      }

      if (copperAction === 'sell' && copperAmt > 0) {
        if (copperAmt > S.lbs) {
          showError('Cannot sell more lbs than owned.');
          return;
        }
        S.lbs -= copperAmt;
        S.cash = roundMoney(S.cash + copperAmt * S.spot);
      }

      if (copperAction === 'buy' && copperAmt > 0) {
        const cost = roundMoney(copperAmt * S.spot);
        // Use epsilon tolerance for comparison
        if (cost > S.cash + 0.01) {
          showError('Not enough cash to buy that many lbs.');
          return;
        }
        S.lbs += copperAmt;
        S.cash = roundMoney(S.cash - cost);
      }

      if (loanAction === 'repay' && loanAmt > 0) {
        const pay = roundMoney(Math.min(loanAmt, S.cash, S.loans));
        if (pay <= 0) {
          showError('Nothing to repay (check cash and loans).');
          return;
        }
        S.loans = roundMoney(S.loans - pay);
        S.cash = roundMoney(S.cash - pay);
      }

      // Use epsilon tolerance for interest validation
      if (S.cash < intThis - 0.01) {
        showError(`Interest payment of $${intThis.toFixed(2)} not covered.`);
        gameOver(`Interest payment of $${intThis.toFixed(2)} not covered`, false);
        return;
      }
      S.cash = roundMoney(S.cash - intThis);

      // Prevent tiny negative cash from floating point errors
      if (S.cash < 0) S.cash = 0;

      // Calculate what net worth will be displayed at start of NEXT turn
      const nextSpot = MARKET[S.year - 1].next;
      const nextIntDue = intv(S.loans);
      const displayedNW = roundMoney((S.cash + S.lbs * nextSpot) - (S.loans + nextIntDue));

      // Validate state - check for NaN corruption
      if (!Number.isFinite(displayedNW) || !Number.isFinite(S.cash) || !Number.isFinite(S.loans)) {
        showError('Game state error - please restart.');
        S.over = true;
        return;
      }

      // Track negative net worth
      if (displayedNW < 0) {
        S.negEquityStreak += 1;
        S.negativeCount += 1;

        if (S.negativeCount >= 3) {
          gameOver("You've been fired for excessive losses", false, `Your net worth has been negative ${S.negativeCount} times.`);
          return;
        }
        if (S.negEquityStreak >= 3) {
          gameOver('Negative equity for 3 consecutive years', false);
          return;
        }
      } else {
        S.negEquityStreak = 0;
      }

      // Generate message based on net worth change
      const nwChange = displayedNW - prevNW;
      let msgType = null, msgTitle = '', msgDetail = '';

      const isFirstTurn = (S.year === 1 && prevNW === 0);
      const noChange = Math.abs(nwChange) < 0.01;

      if (noChange && displayedNW >= 0) {
        // No meaningful change
      } else if (displayedNW < 0 && S.negativeCount >= 2) {
        msgType = 'danger';
        msgTitle = 'Final Warning!';
        msgDetail = `Your net worth is negative for the ${S.negativeCount}${S.negativeCount === 2 ? 'nd' : 'rd'} time. One more and you're fired!`;
      } else if (displayedNW < 0) {
        msgType = 'danger';
        msgTitle = 'Uh oh!';
        msgDetail = `Your net worth is now -$${fmt(Math.abs(displayedNW))}. Shareholders are angry!`;
      } else if (nwChange < -0.01) {
        msgType = 'negative';
        msgTitle = 'Net worth decreased';
        msgDetail = `Your net worth fell by $${fmt(Math.abs(nwChange))}. Time to rethink your strategy?`;
      } else if (nwChange > 0.01) {
        msgType = 'positive';
        msgTitle = 'Nice work!';
        msgDetail = `Your net worth increased by $${fmt(nwChange)}!`;
      }

      S.year += 1;
      if (S.year > YEARS) {
        finishGame();
        return;
      }

      S.prevNW = displayedNW;
      S.loans_beg = S.loans;
      S.spot = MARKET[S.year - 1].spot;
      document.getElementById('copperAmount').value = 0;
      document.getElementById('loanAmount').value = 0;
      document.querySelector('input[name="copperAction"][value="buy"]').checked = true;
      document.querySelector('input[name="loanAction"][value="borrow"]').checked = true;

      showMessage(msgType, msgTitle, msgDetail);
      render();
    } catch (e) {
      showError('Handler error: ' + e.message);
    }
  }

  let finalScore = 0;
  let finalParPercent = 0;

  function finishGame() {
    S.over = true;
    stopTimer();
    if (!PAR) PAR = simulatePar();
    const lastNext = MARKET[YEARS - 1].next;
    const score = (S.cash + S.lbs * lastNext) - S.loans;
    finalScore = roundMoney(score);

    showGameover('Game Complete!', true);
    document.getElementById('finalScore').textContent = '$' + fmt(finalScore);
    document.getElementById('timeInfo').textContent = `Time: ${formatTime(finalTime)}`;

    finalParPercent = 0;
    if (PAR.score > 0) {
      finalParPercent = Math.round((finalScore / PAR.score) * 100);
      document.getElementById('parInfo').textContent = `You achieved ${finalParPercent}% of par`;
    }

    const badge = document.getElementById('performanceBadge');
    if (finalParPercent >= 100) {
      badge.textContent = 'Excellent!';
      badge.className = 'performance-badge excellent';
    } else if (finalParPercent >= 80) {
      badge.textContent = 'Good';
      badge.className = 'performance-badge good';
    } else {
      badge.textContent = 'Room to Improve';
      badge.className = 'performance-badge poor';
    }

    // Show submit button for successful game completion
    document.getElementById('submitScore').style.display = 'inline-block';
  }

  function gameOver(msg, isWin, detail) {
    S.over = true;
    stopTimer();
    showGameover('Game Over', false);

    let fullMsg = msg;
    if (detail) fullMsg += ' - ' + detail;
    document.getElementById('gameoverMsg').textContent = fullMsg;

    // For failed games: don't show score/par, hide submit button
    document.getElementById('finalScore').textContent = 'N/A';
    document.getElementById('parInfo').textContent = '';
    document.getElementById('timeInfo').textContent = '';
    document.getElementById('performanceBadge').className = 'performance-badge poor';
    document.getElementById('performanceBadge').textContent = 'Game Over';

    // Hide the submit button on failure - players cannot submit failed games
    document.getElementById('submitScore').style.display = 'none';
  }

  // ===== Leaderboard (Firebase) =====
  async function addToLeaderboard(name, score, time, parPercent) {
    if (!db) {
      alert('Error: Could not connect to leaderboard. Please refresh the page.');
      return;
    }

    try {
      await db.collection('leaderboard').add({
        name: name,
        score: roundMoney(score),
        time: time,
        parPercent: parPercent,
        date: new Date().toISOString()
      });

      // Get all entries for cleanup
      const snapshot = await db.collection('leaderboard').get();

      // Sort in JavaScript to ensure correct order:
      // Higher score first, then lower time first (for tiebreaker)
      const sortedDocs = snapshot.docs.sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        // Primary: higher score is better (descending)
        if (bData.score !== aData.score) return bData.score - aData.score;
        // Secondary: lower time is better (ascending)
        return aData.time - bData.time;
      });

      // Delete entries beyond top 10
      if (sortedDocs.length > 10) {
        const batch = db.batch();
        sortedDocs.slice(10).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (error) {
      // Silently fail - user can still play again
    }
  }

  function showLeaderboardModal() {
    document.getElementById('modalScore').textContent = '$' + fmt(finalScore);
    document.getElementById('modalTime').textContent = formatTime(finalTime);
    document.getElementById('playerName').value = '';
    document.getElementById('leaderboardModal').classList.remove('hidden');
    document.getElementById('playerName').focus();
  }

  function hideLeaderboardModal() {
    document.getElementById('leaderboardModal').classList.add('hidden');
  }

  async function submitScore() {
    const name = document.getElementById('playerName').value.trim();

    if (!name) {
      document.getElementById('playerName').style.borderColor = 'var(--red)';
      return;
    }

    await addToLeaderboard(name, finalScore, finalTime, finalParPercent);

    hideLeaderboardModal();
    // Redirect to leaderboard page
    window.location.href = 'leaderboard.html';
  }

  function restart() {
    MARKET = generateMarketPath();
    S = {
      year: 1,
      cash: 0,
      loans: 0,
      lbs: 0,
      spot: MARKET[0].spot,
      over: false,
      loans_beg: 0,
      negEquityStreak: 0,
      prevNW: 0,
      negativeCount: 0
    };
    document.getElementById('main').classList.remove('hidden');
    document.getElementById('gameover').classList.add('hidden');
    showError('');
    showMessage(null);
    document.getElementById('copperAmount').value = 0;
    document.getElementById('loanAmount').value = 0;
    document.querySelector('input[name="copperAction"][value="buy"]').checked = true;
    document.querySelector('input[name="loanAction"][value="borrow"]').checked = true;
    document.getElementById('timer').textContent = '00:00';
    PAR = null;

    // Reset submit button visibility for new games
    document.getElementById('submitScore').style.display = 'inline-block';

    startTimer();
    render();
  }

  // ===== Event Listeners =====
  document.getElementById('next').addEventListener('click', processTurn);
  document.getElementById('restart').addEventListener('click', restart);
  document.getElementById('restart2').addEventListener('click', restart);
  document.getElementById('copperAmount').addEventListener('input', updateAmountPrice);
  document.getElementById('copperAmount').addEventListener('change', updateAmountPrice);

  // Leaderboard modal
  document.getElementById('submitScore').addEventListener('click', showLeaderboardModal);
  document.getElementById('cancelSubmit').addEventListener('click', hideLeaderboardModal);
  document.getElementById('confirmSubmit').addEventListener('click', submitScore);
  document.getElementById('playerName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') submitScore();
  });
  document.getElementById('playerName').addEventListener('input', function() {
    this.style.borderColor = 'var(--gray-200)';
  });

  // ===== Debug Functions (exposed globally) =====
  window.debugBorrow = function(amount) {
    console.log('=== DEBUG BORROW TEST ===');
    console.log('Attempting to borrow:', amount);
    console.log('Current S:', JSON.stringify(S, null, 2));
    console.log('---');
    const nw = nwStart();
    const creditLimit = credit();
    const available = Math.max(0, creditLimit - S.loans);
    console.log('nwStart():', nw);
    console.log('credit():', creditLimit);
    console.log('Available (credit - S.loans):', available);
    console.log('Rounded available:', roundMoney(available));
    console.log('---');
    console.log('Would pass validation?', roundMoney(amount) <= roundMoney(available) + 0.01);
    console.log('Difference:', roundMoney(amount) - roundMoney(available));
  };

  window.debugState = function() {
    console.log('=== CURRENT GAME STATE ===');
    console.log('S:', JSON.stringify(S, null, 2));
    console.log('nwStart():', nwStart());
    console.log('credit():', credit());
    console.log('Available credit:', Math.max(0, credit() - S.loans));
  };

  // Initialize
  restart();
})();
