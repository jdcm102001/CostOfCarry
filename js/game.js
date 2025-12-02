/**
 * Copper Trader - Game Logic
 * A 10-year copper trading simulation game
 */

window.onerror = function(message, source, lineno, colno, error) {
  showError('JavaScript error: ' + message + ' @ ' + lineno + ':' + colno);
};

(function() {
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
  const intv = x => x * INTEREST / 100;
  const nwStart = () => (S.cash + S.lbs * S.spot) - (S.loans + intv(S.loans_beg));
  const nwAfter = () => (S.cash + S.lbs * S.spot) - S.loans;
  const credit = () => LINE_OF_CREDIT + nwStart();

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
    const available = Math.max(0, credit() - S.loans);
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
        const lim = Math.max(0, credit() - S.loans);
        if (loanAmt > lim) {
          showError('Borrow exceeds credit limit.');
          return;
        }
        S.loans += loanAmt;
        S.cash += loanAmt;
      }

      if (copperAction === 'sell' && copperAmt > 0) {
        if (copperAmt > S.lbs) {
          showError('Cannot sell more lbs than owned.');
          return;
        }
        S.lbs -= copperAmt;
        S.cash += copperAmt * S.spot;
      }

      if (copperAction === 'buy' && copperAmt > 0) {
        const cost = copperAmt * S.spot;
        if (cost > S.cash) {
          showError('Not enough cash to buy that many lbs.');
          return;
        }
        S.lbs += copperAmt;
        S.cash -= cost;
      }

      if (loanAction === 'repay' && loanAmt > 0) {
        const pay = Math.min(loanAmt, S.cash, S.loans);
        if (pay <= 0) {
          showError('Nothing to repay (check cash and loans).');
          return;
        }
        S.loans -= pay;
        S.cash -= pay;
      }

      if (S.cash < intThis - 0.001) {
        showError(`Interest payment of $${intThis.toFixed(2)} not covered.`);
        gameOver(`Interest payment of $${intThis.toFixed(2)} not covered`, false);
        return;
      }
      S.cash -= intThis;

      // Prevent tiny negative cash from floating point errors
      if (S.cash < 0 && S.cash > -0.01) S.cash = 0;

      // Calculate what net worth will be displayed at start of NEXT turn
      const nextSpot = MARKET[S.year - 1].next;
      const nextIntDue = intv(S.loans);
      const displayedNW = (S.cash + S.lbs * nextSpot) - (S.loans + nextIntDue);

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

  function finishGame() {
    stopTimer();
    if (!PAR) PAR = simulatePar();
    const lastNext = MARKET[YEARS - 1].next;
    const score = (S.cash + S.lbs * lastNext) - S.loans;
    finalScore = score;

    showGameover('Game Complete!', true);
    document.getElementById('finalScore').textContent = '$' + fmt(score);
    document.getElementById('timeInfo').textContent = `Time: ${formatTime(finalTime)}`;

    let pct = 0;
    if (PAR.score > 0) {
      pct = Math.round((score / PAR.score) * 100);
      document.getElementById('parInfo').textContent = `Par: $${fmt(PAR.score)} - You achieved ${pct}%`;
    }

    const badge = document.getElementById('performanceBadge');
    if (pct >= 100) {
      badge.textContent = 'Excellent!';
      badge.className = 'performance-badge excellent';
    } else if (pct >= 80) {
      badge.textContent = 'Good';
      badge.className = 'performance-badge good';
    } else {
      badge.textContent = 'Room to Improve';
      badge.className = 'performance-badge poor';
    }
  }

  function gameOver(msg, isWin, detail) {
    stopTimer();
    if (!PAR) PAR = simulatePar();
    showGameover('Game Over', false);
    let fullMsg = msg;
    if (detail) fullMsg += ' - ' + detail;
    document.getElementById('gameoverMsg').textContent = fullMsg;

    const lastNext = MARKET[Math.min(S.year, YEARS) - 1].next;
    const score = (S.cash + S.lbs * lastNext) - S.loans;
    finalScore = score;
    document.getElementById('finalScore').textContent = '$' + fmt(score);
    document.getElementById('timeInfo').textContent = `Time: ${formatTime(finalTime)}`;

    document.getElementById('parInfo').textContent = `Par: $${fmt(PAR.score)}`;
    document.getElementById('performanceBadge').className = 'performance-badge poor';
    document.getElementById('performanceBadge').textContent = 'Game Over';
  }

  // ===== Leaderboard =====
  function getLeaderboard() {
    const data = localStorage.getItem('copperTraderLeaderboard');
    return data ? JSON.parse(data) : [];
  }

  function saveLeaderboard(leaderboard) {
    localStorage.setItem('copperTraderLeaderboard', JSON.stringify(leaderboard));
  }

  function addToLeaderboard(name, score, time) {
    const leaderboard = getLeaderboard();
    leaderboard.push({ name, score, time, date: new Date().toISOString() });
    // Sort by score (desc), then by time (asc) for tiebreaker
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.time - b.time;
    });
    // Keep top 50
    if (leaderboard.length > 50) leaderboard.length = 50;
    saveLeaderboard(leaderboard);
    return leaderboard;
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

  function submitScore() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
      document.getElementById('playerName').style.borderColor = 'var(--red)';
      return;
    }
    addToLeaderboard(name, finalScore, finalTime);
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

  // Initialize
  restart();
})();
