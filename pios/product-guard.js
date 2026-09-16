(() => {
  'use strict';

  const SUPABASE_ORIGIN = 'https://filwikflcfkytajancpj.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_bqkvtp7tlMykMbYgBWNSoA_Uz4vlI9z';

  async function checkPersonalModel() {
    const token = localStorage.getItem('pios_token');
    if (!token) return;

    try {
      const response = await fetch(`${SUPABASE_ORIGIN}/functions/v1/personal-model`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) return;
      const data = await response.json();
      const model = data?.model || {};
      const profile = model?.profile || null;
      const goals = Array.isArray(model?.goals) ? model.goals : [];
      const incomplete = !profile || profile.onboarding_complete !== true || goals.length === 0;

      if (incomplete && typeof window.openOnboarding === 'function') {
        window.openOnboarding();
      }
    } catch (_) {
      // The main app owns user-visible error handling.
    }
  }

  window.addEventListener('load', () => setTimeout(checkPersonalModel, 900));
})();
