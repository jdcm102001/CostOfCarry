/**
 * Copper Trader - Leaderboard Logic
 * Displays and manages the high scores leaderboard (Firebase)
 */

console.log('=== leaderboard.js file loaded ===');

(function() {
  console.log('=== Leaderboard IIFE starting ===');

  // ===== Firebase =====
  let db = null;
  try {
    console.log('Leaderboard: Firebase typeof:', typeof firebase);
    if (typeof firebase !== 'undefined') {
      db = firebase.firestore();
      console.log('Leaderboard: Firebase initialized successfully');
      console.log('Leaderboard: Firestore db:', typeof db);
    } else {
      console.error('Leaderboard: Firebase SDK not loaded!');
    }
  } catch (e) {
    console.error('Leaderboard: Firebase initialization error:', e);
  }

  /**
   * Retrieve leaderboard from Firebase
   */
  async function getLeaderboard() {
    console.log('=== getLeaderboard called ===');

    if (!db) {
      console.error('ERROR: Firebase db is not initialized!');
      return [];
    }

    try {
      const snapshot = await db.collection('leaderboard')
        .orderBy('score', 'desc')
        .orderBy('time', 'asc')
        .limit(10)
        .get();

      console.log('Snapshot size:', snapshot.size);
      console.log('Documents:', snapshot.docs.map(doc => doc.data()));

      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('FIREBASE ERROR in getLeaderboard:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      return [];
    }
  }

  /**
   * Format seconds to MM:SS
   */
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  /**
   * Format number for display
   */
  function fmt(n) {
    const v = Number(n);
    if (Number.isInteger(v)) return String(v);
    const rounded = Math.round(v * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render the leaderboard table
   */
  async function renderLeaderboard() {
    const container = document.getElementById('leaderboardContent');

    // Check if Firebase is initialized
    if (!db) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <p>Unable to connect to leaderboard. Please check your internet connection and refresh the page.</p>
          <a href="game.html" class="btn btn-primary">Play Game</a>
        </div>
      `;
      return;
    }

    // Show loading state
    container.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    const leaderboard = await getLeaderboard();

    if (leaderboard.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📊</div>
          <p>No scores yet. Be the first to make the leaderboard!</p>
          <a href="game.html" class="btn btn-primary">Play Now</a>
        </div>
      `;
      return;
    }

    let html = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>% of Par</th>
            <th>Net Worth</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
    `;

    leaderboard.forEach((entry, index) => {
      const rank = index + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      const scoreClass = entry.score >= 0 ? 'positive' : 'negative';
      const scorePrefix = entry.score >= 0 ? '$' : '-$';
      const scoreValue = Math.abs(entry.score);

      // Handle backwards compatibility for entries without parPercent
      const parPercent = entry.parPercent !== undefined ? `${entry.parPercent}%` : '—';

      html += `
        <tr class="${rankClass}">
          <td>${rank}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>${parPercent}</td>
          <td class="${scoreClass}">${scorePrefix}${fmt(scoreValue)}</td>
          <td>${formatTime(entry.time)}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Initialize
  renderLeaderboard();
})();
