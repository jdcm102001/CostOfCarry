/**
 * Copper Trader - Leaderboard Logic
 * Displays and manages the high scores leaderboard (Firebase)
 */

console.log('=== leaderboard.js file loaded ===');

(function() {
  console.log('=== Leaderboard IIFE starting ===');

  // ===== Firebase =====
  // Check Firebase is available
  if (typeof firebase === 'undefined') {
    console.error('Firebase not loaded!');
    return;
  }

  let db = null;
  try {
    db = firebase.firestore();
    console.log('Firestore db initialized:', db);
  } catch (e) {
    console.error('Firebase initialization error:', e);
  }

  /**
   * Sort leaderboard entries: higher score first, then lower time first
   */
  function sortLeaderboard(data) {
    return data.sort((a, b) => {
      // Primary: higher score is better (descending)
      if (b.score !== a.score) return b.score - a.score;
      // Secondary: lower time is better (ascending)
      return a.time - b.time;
    });
  }

  async function getLeaderboard() {
    console.log('=== getLeaderboard called ===');
    console.log('db value:', db);

    if (!db) {
      console.error('ERROR: db is null/undefined');
      return [];
    }

    try {
      // Try with ordering first (requires composite index)
      console.log('Attempting query with ordering...');
      const snapshot = await db.collection('leaderboard')
        .orderBy('score', 'desc')
        .orderBy('time', 'asc')
        .limit(10)
        .get();

      console.log('Snapshot received, size:', snapshot.size);
      const data = snapshot.docs.map(doc => doc.data());
      console.log('Raw data from Firebase:', data);

      // Always sort in JS to ensure correct order (in case index is misconfigured)
      const sorted = sortLeaderboard(data);
      console.log('Sorted data:', sorted);
      return sorted;
    } catch (error) {
      console.error('ERROR in getLeaderboard:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      // Fallback: try without ordering if index isn't ready
      if (error.code === 'failed-precondition') {
        console.log('Index not ready, trying fallback query without ordering...');
        try {
          const fallbackSnapshot = await db.collection('leaderboard').limit(10).get();
          console.log('Fallback snapshot size:', fallbackSnapshot.size);
          const data = fallbackSnapshot.docs.map(doc => doc.data());
          const sorted = sortLeaderboard(data);
          console.log('Fallback data (sorted in JS):', sorted);
          return sorted;
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return [];
        }
      }
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
    console.log('=== renderLeaderboard starting ===');
    const container = document.getElementById('leaderboardContent');
    console.log('Container element:', container);

    // Check if Firebase is initialized
    if (!db) {
      console.error('db is not initialized in renderLeaderboard');
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
    console.log('Leaderboard data received:', leaderboard);
    console.log('Leaderboard length:', leaderboard.length);

    if (leaderboard.length === 0) {
      console.log('No leaderboard entries, showing empty state');
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📊</div>
          <p>No scores yet. Be the first to make the leaderboard!</p>
          <a href="game.html" class="btn btn-primary">Play Now</a>
        </div>
      `;
      return;
    }

    console.log('Rendering', leaderboard.length, 'entries');
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
    console.log('=== renderLeaderboard complete ===');
  }

  // Initialize
  console.log('Calling renderLeaderboard()...');
  renderLeaderboard();
})();
