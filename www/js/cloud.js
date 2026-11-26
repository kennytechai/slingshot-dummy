/* =========================================================
   SLINGSHOT DUMMY — JakePlay Cloud Account & Stats Client
   Shares the exact same JakePlay account & jp_session cookie
   at https://api.jakeplay.com (JakeTeam LLC).
   Unregistered guests stay 100% local in browser storage.
   ========================================================= */

(function () {
  const API_BASE = 'https://api.jakeplay.com';
  const TOKEN_KEY = 'jakeplay_auth_token';
  const GAME_ID = 'slingshot-dummy';

  class JakePlayCloud {
    constructor() {
      this.user = null;
      this.tier = 'free';
      this.onAuthChange = null;
    }

    isPremium() {
      return Boolean(this.user && this.user.tier === 'premium');
    }

    async _fetch(path, opts = {}) {
      const token = localStorage.getItem(TOKEN_KEY);
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(API_BASE + path, { ...opts, headers, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async init() {
      try {
        const data = await this._fetch('/api/me');
        this.user = data.user || null;
        this.tier = this.user ? (this.user.tier || 'registered') : 'free';
      } catch (e) {
        this.user = null;
        this.tier = 'free';
      }
      if (this.onAuthChange) this.onAuthChange(this.user, 'init');
      return this.user;
    }

    async register(payload) {
      const data = await this._fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      this.user = data.user;
      this.tier = this.user.tier || 'registered';
      if (this.onAuthChange) this.onAuthChange(this.user, 'register');
      return this.user;
    }

    async login(emailOrHandle, password) {
      const data = await this._fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrHandle, password })
      });
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      this.user = data.user;
      this.tier = this.user.tier || 'registered';
      if (this.onAuthChange) this.onAuthChange(this.user, 'login');
      return this.user;
    }

    async logout() {
      try { await this._fetch('/api/logout', { method: 'POST' }); } catch (e) {}
      localStorage.removeItem(TOKEN_KEY);
      this.user = null;
      this.tier = 'free';
      if (this.onAuthChange) this.onAuthChange(null, 'logout');
    }

    async deleteAccount(password) {
      if (!this.user) throw new Error('Not signed in.');
      const deletedId = this.user.id;
      await this._fetch('/api/account', {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      localStorage.removeItem(TOKEN_KEY);
      this.user = null;
      this.tier = 'free';
      if (this.onAuthChange) this.onAuthChange(null, 'delete', deletedId);
      return true;
    }

    async loadProgress() {
      if (!this.user) return null;
      try {
        const data = await this._fetch(`/api/progress?game=${GAME_ID}`);
        return data.progress || null;
      } catch (e) {
        return null;
      }
    }

    async saveProgress(saveObj, opts = {}) {
      if (!this.user) return null;
      try {
        const data = await this._fetch('/api/progress', {
          method: 'POST',
          keepalive: Boolean(opts.keepalive),
          body: JSON.stringify({
            gameId: GAME_ID,
            unlocked: saveObj.unlocked || 1,
            bestTimes: saveObj.bestTimes || {},
            worldStats: saveObj.worldStats || {},
            aura: saveObj.aura || 0,
            totalDeaths: saveObj.totalDeaths || 0,
            difficulty: saveObj.difficulty || 'normal'
          })
        });
        return data.progress || null;
      } catch (e) {
        return null;
      }
    }

    async startRun(worldNum, difficulty) {
      if (!this.user || !['normal', 'hard', 'ultimate'].includes(difficulty)) return null;
      try {
        const data = await this._fetch('/api/runs/start', {
          method: 'POST',
          body: JSON.stringify({ gameId: GAME_ID, worldNum, difficulty })
        });
        return data.runToken || null;
      } catch (e) {
        return null;
      }
    }

    async submitScore(worldNum, difficulty, clearTimeSec, bonks, aura, tries, runToken) {
      if (!this.user || !['normal', 'hard', 'ultimate'].includes(difficulty) || !runToken) return false;
      try {
        await this._fetch('/api/scores', {
          method: 'POST',
          body: JSON.stringify({
            gameId: GAME_ID,
            worldNum,
            difficulty,
            clearTimeMs: Math.round(clearTimeSec * 1000),
            bonks,
            tries: Math.max(1, tries || 1),
            aura,
            runToken
          })
        });
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  window.JakePlayCloud = new JakePlayCloud();
})();
