(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let currentContext = null;

  const text = v => v == null ? '' : String(v);
  const score = v => v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v));
  const money = (v, currency='CAD') => v == null ? null : Number(v).toLocaleString('en-CA',{style:'currency',currency,maximumFractionDigits:0});
  const dateLabel = v => {
    if(!v) return null;
    const d = new Date(v);
    if(Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  };
  const daysUntil = v => {
    if(!v) return null;
    const ms = new Date(v).getTime() - Date.now();
    if(Number.isNaN(ms)) return null;
    return Math.ceil(ms / 86400000);
  };

  function ensureShell(){
    const move = document.querySelector('.next-move');
    if(move && !$('strategyContext')){
      const box = document.createElement('div');
      box.id = 'strategyContext';
      box.className = 'strategy-context';
      box.innerHTML = `
        <div class="context-head"><span>WHY NOW</span><span id="contextFreshness" class="context-freshness">WAITING FOR CONTEXT</span></div>
        <div class="context-grid">
          <section class="context-card trigger-card">
            <div class="context-kicker">WORLD TRIGGER</div>
            <b id="contextTriggerTitle">No exact external trigger linked yet.</b>
            <p id="contextTriggerMeta">PIOS may also synthesize recommendations from broader market and personal-state evidence.</p>
            <div class="context-actions"><button id="viewTriggerBtn" class="mini-action hidden" type="button">View on Earth</button><a id="contextSource" class="mini-link hidden" target="_blank" rel="noopener noreferrer">Source ↗</a></div>
          </section>
          <section class="context-card consequence-card">
            <div class="context-kicker">PERSONAL CONSEQUENCE</div>
            <b id="contextWhyYou">PIOS is calculating why this move matters to you.</b>
            <p id="contextMechanism"></p>
          </section>
        </div>
        <div id="contextNumbers" class="context-numbers"></div>
        <div id="decisionState" class="decision-state">No decision recorded in this session.</div>`;
      const why = $('moveWhy');
      if(why) why.insertAdjacentElement('afterend',box); else move.appendChild(box);
    }

    const inspector = $('signalInspector');
    if(inspector && !$('signalWhyYou')){
      const box = document.createElement('div');
      box.id = 'signalWhyYou';
      box.className = 'signal-why-you';
      box.innerHTML = '<span>WHY YOU</span><b>Personal relevance will appear when this signal is linked to your model.</b>';
      inspector.appendChild(box);
    }
  }

  function metricPill(label,value,suffix=''){
    if(value == null) return '';
    return `<div class="context-stat"><span>${label}</span><b>${value}${suffix}</b></div>`;
  }

  function rangeText(low,high,currency){
    if(low==null && high==null) return null;
    if(low!=null && high!=null && Number(low)!==Number(high)) return `${money(low,currency)} – ${money(high,currency)}`;
    return money(low ?? high,currency);
  }

  function signalForContext(ctx){
    const s=ctx?.signal,c=ctx?.candidate;
    if(!s)return null;
    return {...s,relevance_score:c?.scores?.relevance,confidence_score:c?.scores?.confidence,impact_score:c?.scores?.impact,module_code:c?.module_code,world_role:'strategy_trigger'};
  }

  function renderContext(ctx){
    ensureShell();
    currentContext = ctx;
    const c = ctx?.candidate || null;
    const s = ctx?.signal || null;
    const ev = ctx?.evidence_summary || null;
    const move = ctx?.move || null;

    const fresh = $('contextFreshness');
    if(fresh) fresh.textContent = ctx?.generated_at ? `STRATEGY ${dateLabel(ctx.generated_at) || 'CURRENT'}` : 'CURRENT STRATEGY';

    const triggerTitle = $('contextTriggerTitle');
    const triggerMeta = $('contextTriggerMeta');
    const source = $('contextSource');
    const view = $('viewTriggerBtn');
    if(s){
      if(triggerTitle) triggerTitle.textContent = s.title || 'Linked world signal';
      const loc = [s.organization,s.locality,s.region].filter(Boolean).join(' · ');
      const deadline = dateLabel(s.deadline_at);
      const remaining = daysUntil(s.deadline_at);
      const timing = deadline ? `deadline ${deadline}${remaining!=null ? ` · ${remaining < 0 ? 'closed/past' : `${remaining} day${remaining===1?'':'s'} left`}` : ''}` : (dateLabel(s.published_at) ? `published ${dateLabel(s.published_at)}` : 'live evidence');
      if(triggerMeta) triggerMeta.textContent = [loc,timing].filter(Boolean).join(' · ');
      if(source){
        if(/^https?:\/\//i.test(s.source_url||'')){ source.href=s.source_url; source.classList.remove('hidden'); }
        else source.classList.add('hidden');
      }
      if(view){ view.classList.remove('hidden'); view.onclick=()=>{
        const signalForUI=signalForContext(ctx);
        if(typeof window.showSignal==='function') window.showSignal(signalForUI);
        $('signalInspector')?.scrollIntoView({behavior:'smooth',block:'center'});
      };}
    } else {
      if(triggerTitle) triggerTitle.textContent = 'No single external trigger is required for this move.';
      if(triggerMeta) triggerMeta.textContent = move?.decision==='DO_NOTHING' ? 'PIOS is preserving capital, time and attention because no option currently clears the strategy threshold.' : 'This recommendation is synthesized from the broader Personal Model and current opportunity set.';
      source?.classList.add('hidden');
      view?.classList.add('hidden');
    }

    if($('contextWhyYou')) $('contextWhyYou').textContent = c?.why_you || move?.why || 'PIOS is comparing this option against your goals, constraints and available resources.';
    if($('contextMechanism')) $('contextMechanism').textContent = c?.mechanism || c?.next_action || move?.action || '';

    const currency = c?.currency || 'CAD';
    const upside = rangeText(c?.expected_upside_low,c?.expected_upside_high,currency);
    const downside = rangeText(c?.expected_downside_low,c?.expected_downside_high,currency);
    const capital = rangeText(c?.capital_required_low,c?.capital_required_high,currency);
    const deadlineDays = daysUntil(c?.window_end || s?.deadline_at);
    const pieces = [];
    if(c?.scores){
      pieces.push(metricPill('Relevance',score(c.scores.relevance),''));
      pieces.push(metricPill('Impact',score(c.scores.impact),''));
      pieces.push(metricPill('Confidence',score(c.scores.confidence),'%'));
      pieces.push(metricPill('Risk',score(c.scores.risk),''));
    }
    if(upside) pieces.push(metricPill('Potential upside',upside,''));
    if(downside) pieces.push(metricPill('Potential downside',downside,''));
    if(capital) pieces.push(metricPill('Capital required',capital,''));
    if(c?.time_required_hours!=null) pieces.push(metricPill('Time required',Number(c.time_required_hours).toLocaleString()+'h',''));
    if(deadlineDays!=null) pieces.push(metricPill('Window',deadlineDays < 0 ? 'Past' : `${deadlineDays}d`,''));
    if(c?.eligibility_status) pieces.push(metricPill('Eligibility',text(c.eligibility_status).replaceAll('_',' ').toUpperCase(),''));
    if(ev?.facts!=null){
      const evidenceText=ev.scope==='internal_diagnostic' ? `${ev.facts} personal facts · internal diagnostic` : `${ev.facts} facts · ${ev.sources||0} sources`;
      pieces.push(metricPill('Evidence',evidenceText,''));
    }
    if($('contextNumbers')) $('contextNumbers').innerHTML = pieces.filter(Boolean).join('');

    document.querySelectorAll('[data-decision="approve"]').forEach(btn=>btn.textContent='Approve next step');
  }

  async function loadRecommendationContext(){
    if(!localStorage.getItem('pios_token') || typeof window.api!=='function') return;
    try{
      const ctx = await window.api('/functions/v1/recommendation-context');
      renderContext(ctx);
      const trigger=signalForContext(ctx);
      if(trigger && typeof window.showSignal==='function') window.showSignal(trigger);
    }catch(e){
      ensureShell();
      if($('contextFreshness')) $('contextFreshness').textContent='CONTEXT TEMPORARILY UNAVAILABLE';
    }
  }

  function enhanceSignal(signal){
    ensureShell();
    const box=$('signalWhyYou');
    if(!box || !signal) return;
    const r=score(signal.relevance_score), i=score(signal.impact_score), c=score(signal.confidence_score);
    const exact=currentContext?.signal?.id && currentContext.signal.id===signal.id;
    const bits=[];
    if(r!=null) bits.push(`relevance ${r}`);
    if(i!=null) bits.push(`impact ${i}`);
    if(c!=null) bits.push(`confidence ${c}%`);
    box.innerHTML='';
    const label=document.createElement('span'); label.textContent=exact?'WHY THIS DRIVES YOUR #1 MOVE':'WHY YOU';
    const body=document.createElement('b');
    if(exact){
      body.textContent=`${currentContext?.candidate?.why_you || 'This signal is directly linked to your current top recommendation.'}${bits.length?' · '+bits.join(' · '):''}`;
    }else if(signal.why_you){
      body.textContent=`${signal.why_you}${bits.length?' · '+bits.join(' · '):''}`;
    }else{
      body.textContent=bits.length ? `PIOS kept this signal because ${bits.join(' · ')}.` : 'This signal is in your current personalized attention set.';
    }
    box.append(label,body);
  }

  function installHooks(){
    ensureShell();
    if(typeof window.renderExperience==='function' && !window.renderExperience.__piosEnhanced){
      const original=window.renderExperience;
      const wrapped=function(data){
        const result=original(data);
        setTimeout(loadRecommendationContext,0);
        const updated=data?.generated_at || data?.strategy?.generated_at;
        const status=$('connectionStatus');
        if(status && updated && status.textContent.includes('CONNECTED')) status.title=`Latest intelligence: ${new Date(updated).toLocaleString()}`;
        return result;
      };
      wrapped.__piosEnhanced=true;
      window.renderExperience=wrapped;
    }
    if(typeof window.showSignal==='function' && !window.showSignal.__piosEnhanced){
      const original=window.showSignal;
      const wrapped=function(signal){ const result=original(signal); enhanceSignal(signal); return result; };
      wrapped.__piosEnhanced=true;
      window.showSignal=wrapped;
    }
    if(typeof window.recordDecision==='function' && !window.recordDecision.__piosEnhanced){
      const original=window.recordDecision;
      const wrapped=async function(action){
        const state=$('decisionState');
        if(state) state.textContent=`Recording ${String(action).replaceAll('_',' ')}…`;
        try{
          const result=await original(action);
          if(state) state.textContent=`Decision recorded: ${String(action).replaceAll('_',' ').toUpperCase()}. PIOS will incorporate the outcome into future strategy.`;
          setTimeout(loadRecommendationContext,300);
          return result;
        }catch(e){ if(state) state.textContent='Decision could not be recorded.'; throw e; }
      };
      wrapped.__piosEnhanced=true;
      window.recordDecision=wrapped;
    }
    if(localStorage.getItem('pios_token')) setTimeout(loadRecommendationContext,700);
  }

  window.addEventListener('load',()=>setTimeout(installHooks,80));
})();
