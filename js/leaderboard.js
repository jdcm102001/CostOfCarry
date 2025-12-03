/**
 * Copper Trader - Leaderboard Logic
 * Displays and manages the high scores leaderboard
 */

(function() {
  /**
   * Retrieve leaderboard from localStorage
   */
  function getLeaderboard() {
    const data = localStorage.getItem('copperTraderLeaderboard');
    return data ? JSON.parse(data) : [];
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
  function renderLeaderboard() {
    const leaderboard = getLeaderboard();
    const container = document.getElementById('leaderboardContent');

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

  /**
   * Clear the entire leaderboard
   */
  function clearLeaderboard() {
    if (confirm('Are you sure you want to clear the entire leaderboard? This cannot be undone.')) {
      localStorage.removeItem('copperTraderLeaderboard');
      renderLeaderboard();
    }
  }

  // Event listeners
  document.getElementById('clearLeaderboard').addEventListener('click', clearLeaderboard);

  // Initialize
  renderLeaderboard();
})();
