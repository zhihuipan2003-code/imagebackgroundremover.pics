// Authentication Manager for Google OAuth
class AuthManager {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = null;
    this.init();
  }

  async init() {
    // Check URL for token from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      this.token = token;
      localStorage.setItem('authToken', token);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (this.token) {
      await this.loadUser();
    }
    
    this.updateUI();
  }

  async loadUser() {
    try {
      const response = await fetch('/api/user', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        this.user = await response.json();
      } else {
        this.logout();
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      this.logout();
    }
  }

  updateUI() {
    const loginSection = document.getElementById('login-section');
    const userSection = document.getElementById('user-section');
    
    if (this.user) {
      loginSection.style.display = 'none';
      userSection.style.display = 'block';
      document.getElementById('user-avatar').src = this.user.picture;
      document.getElementById('user-name').textContent = this.user.name;
      this.showUserFeatures();
    } else {
      loginSection.style.display = 'block';
      userSection.style.display = 'none';
      this.hideUserFeatures();
    }
  }

  showUserFeatures() {
    let featuresSection = document.getElementById('user-features');
    
    if (!featuresSection) {
      featuresSection = document.createElement('div');
      featuresSection.id = 'user-features';
      featuresSection.style.marginTop = '40px';
      
      featuresSection.innerHTML = `
        <div style="margin-bottom: 30px; padding: 25px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e0e0e0;">
          <h3 style="margin-bottom: 20px; color: #333;">📊 Your Statistics</h3>
          <div id="user-stats">Loading stats...</div>
        </div>
        
        <div style="padding: 25px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e0e0e0;">
          <h3 style="margin-bottom: 20px; color: #333;">📸 Processing History</h3>
          <div id="history-list">Loading your history...</div>
        </div>
      `;
      
      document.querySelector('.container').appendChild(featuresSection);
    }
    
    this.loadStats();
    this.loadHistory();
  }

  hideUserFeatures() {
    const featuresSection = document.getElementById('user-features');
    if (featuresSection) {
      featuresSection.remove();
    }
  }

  async loadHistory() {
    try {
      const response = await fetch('/api/history', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const history = await response.json();
        const listEl = document.getElementById('history-list');
        
        if (history.length === 0) {
          listEl.innerHTML = '<p style="color: #666;">No history yet. Start processing some images!</p>';
        } else {
          listEl.innerHTML = history.map(item => `
            <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 8px; display: flex; align-items: center; gap: 15px;">
              <img src="${item.result_url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none';">
              <div style="flex: 1;">
                <div style="font-size: 14px; color: #666; margin-bottom: 5px;">
                  ${new Date(item.created_at).toLocaleString()}
                </div>
                <div style="display: flex; gap: 10px;">
                  <a href="${item.result_url}" download style="color: #1a73e8; text-decoration: none; font-weight: 500;">
                    📥 Download
                  </a>
                  <button onclick="window.authManager.deleteHistory(${item.id})" 
                          style="color: #d93025; background: none; border: none; cursor: pointer; font-size: 14px;">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      document.getElementById('history-list').innerHTML = 
        '<p style="color: #d93025;">Failed to load history. Please try again.</p>';
    }
  }

  async deleteHistory(historyId) {
    if (!confirm('Are you sure you want to delete this item from your history?')) {
      return;
    }

    try {
      const response = await fetch('/api/history/delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ historyId }),
      });

      if (response.ok) {
        // Reload history after deletion
        await this.loadHistory();
        // Refresh stats
        await this.loadStats();
      } else {
        const error = await response.json();
        alert(`Failed to delete: ${error.error}`);
      }
    } catch (err) {
      console.error('Failed to delete history:', err);
      alert('Failed to delete item. Please try again.');
    }
  }

  async loadStats() {
    try {
      const response = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const stats = await response.json();
        this.updateStatsUI(stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  updateStatsUI(stats) {
    const statsEl = document.getElementById('user-stats');
    if (!statsEl) return;

    statsEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div style="text-align: center; padding: 15px; background: #e8f0fe; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #1a73e8;">${stats.total_processed || 0}</div>
          <div style="font-size: 12px; color: #5f6368;">Total Processed</div>
        </div>
        <div style="text-align: center; padding: 15px; background: #e6f4ea; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #137333;">${stats.today_processed || 0}</div>
          <div style="font-size: 12px; color: #5f6368;">Today</div>
        </div>
        <div style="text-align: center; padding: 15px; background: #fef7e0; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #ea8600;">${stats.days_active || 0}</div>
          <div style="font-size: 12px; color: #5f6368;">Days Active</div>
        </div>
      </div>
    `;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('authToken');
    this.updateUI();
  }

  async saveProcessingHistory(originalUrl, resultUrl) {
    if (!this.token) return;

    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_url: originalUrl,
          result_url: resultUrl,
        }),
      });
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  }
}

// Initialize auth manager
const authManager = new AuthManager();

// Bind logout button
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => authManager.logout());
  }
});

// Export for use in other files
window.authManager = authManager;
