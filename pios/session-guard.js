(() => {
  'use strict';

  const SUPABASE_ORIGIN = 'https://filwikflcfkytajancpj.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_bqkvtp7tlMykMbYgBWNSoA_Uz4vlI9z';
  const ACCESS_KEY = 'pios_token';
  const REFRESH_KEY = 'pios_refresh_token';
  const nativeFetch = window.fetch.bind(window);
  let refreshPromise = null;

  function isSupabase(input) {
    const url = typeof input === 'string' ? input : input?.url || '';
    return url.startsWith(SUPABASE_ORIGIN);
  }

  function isAuthTokenRequest(input) {
    const url = typeof input === 'string' ? input : input?.url || '';
    return url.includes('/auth/v1/token');
  }

  async function captureSession(response) {
    try {
      const data = await response.clone().json();
      if (data?.access_token) localStorage.setItem(ACCESS_KEY, data.access_token);
      if (data?.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
    } catch (_) {}
  }

  async function refreshSession() {
    if (refreshPromise) return refreshPromise;
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;

    refreshPromise = (async () => {
      try {
        const response = await nativeFetch(`${SUPABASE_ORIGIN}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (!response.ok) throw new Error('refresh_failed');
        const data = await response.json();
        if (!data?.access_token) throw new Error('refresh_missing_token');
        localStorage.setItem(ACCESS_KEY, data.access_token);
        if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
        return data.access_token;
      } catch (_) {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  function withLatestAuthorization(init = {}) {
    const headers = new Headers(init.headers || {});
    const accessToken = localStorage.getItem(ACCESS_KEY);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return { ...init, headers };
  }

  window.fetch = async function guardedFetch(input, init = {}) {
    if (!isSupabase(input)) return nativeFetch(input, init);

    let requestInit = withLatestAuthorization(init);
    let response = await nativeFetch(input, requestInit);

    if (isAuthTokenRequest(input)) {
      captureSession(response);
      return response;
    }

    if (response.status === 401 && localStorage.getItem(REFRESH_KEY)) {
      const newToken = await refreshSession();
      if (newToken) {
        requestInit = withLatestAuthorization(init);
        response = await nativeFetch(input, requestInit);
      }
    }

    return response;
  };

  // Keep refresh-token storage aligned with the app's existing sign-out flow.
  setInterval(() => {
    if (!localStorage.getItem(ACCESS_KEY)) localStorage.removeItem(REFRESH_KEY);
  }, 1500);
})();
