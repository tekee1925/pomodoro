// app.js - Pomodoro timer
const defaults = {
  work: 25,
  short: 5,
  long: 15,
  cyclesBeforeLong: 4,
  sound: true,
  autoStart: false
};

const MODE_LABELS = {
  work: 'Work',
  short: 'Short Break',
  long: 'Long Break'
};

const els = {
  timeDisplay: document.getElementById('timeDisplay'),
  modeLabel: document.getElementById('modeLabel'),
  startPauseBtn: document.getElementById('startPauseBtn'),
  skipBtn: document.getElementById('skipBtn'),
  resetBtn: document.getElementById('resetBtn'),
  addMinBtn: document.getElementById('addMinBtn'),
  subMinBtn: document.getElementById('subMinBtn'),
  cyclesLabel: document.getElementById('cyclesLabel'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  workInput: document.getElementById('workInput'), 
  shortInput: document.getElementById('shortInput'),
  longInput: document.getElementById('longInput'),
  cyclesBeforeLong: document.getElementById('cyclesBeforeLong'),
  soundToggle: document.getElementById('soundToggle'),
  autoStartToggle: document.getElementById('autoStartToggle'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  bellAudio: document.getElementById('bellAudio')
};

let settings = loadSettings();
let current = {
  mode: 'work', // 'work' | 'short' | 'long'
  remaining: settings.work * 60,
  running: false,
  cycles: 0,
  intervalId: null
};

const ring = document.querySelector('.ring');
const R = 54;
const circumference = 2 * Math.PI * R;
ring.style.strokeDasharray = `${circumference} ${circumference}`;
ring.style.strokeDashoffset = `${circumference}`;

init();

function init(){
  // populate inputs
  els.workInput.value = settings.work;
  els.shortInput.value = settings.short;
  els.longInput.value = settings.long;
  els.cyclesBeforeLong.value = settings.cyclesBeforeLong;
  els.soundToggle.checked = settings.sound;
  els.autoStartToggle.checked = settings.autoStart;

  bind();
  updateDisplay();
  updateCycleLabel();
  updateModeLabel();
}

function bind(){
    els.startPauseBtn.addEventListener('click', toggleStartPause);
  els.skipBtn.addEventListener('click', () => {onPeriodEnd();});
  els.resetBtn.addEventListener('click', resetCurrent);

   // Time adjustment handlers
  els.addMinBtn.addEventListener('click', () => adjustTime(60));
  els.subMinBtn.addEventListener('click', () => adjustTime(-60));

  els.settingsBtn.addEventListener('click', ()=>openModal(true));
  els.closeSettingsBtn.addEventListener('click', ()=>openModal(false));
  els.saveSettingsBtn.addEventListener('click', saveSettings);
  window.addEventListener('beforeunload', ()=>{ if(current.running) saveState(); });
}

function startTimer(){
  if (current.running) return;
  current.running = true;
  els.startPauseBtn.textContent = 'Pause';
  current.intervalId = setInterval(tick, 1000);
}

function pauseTimer(){
  if (!current.running) return;
  current.running = false;
  els.startPauseBtn.textContent = 'Start';
  clearInterval(current.intervalId);
  current.intervalId = null;
}

function toggleStartPause(){
  current.running ? pauseTimer() : startTimer();
}

function resetCurrent(){
  pauseTimer();
  current.remaining = settingsDurationFor(current.mode) * 60;
  updateDisplay();
  updateRing();
}

function adjustTime(deltaSeconds){
  if (typeof deltaSeconds !== 'number') return;
  const before = current.remaining;
  current.remaining = Math.max(0, current.remaining + Math.trunc(deltaSeconds));
  updateDisplay();
  updateRing();

  // If we moved from >0 to 0, treat as finished
  if (before > 0 && current.remaining === 0){
    // call onPeriodEnd to run the same transition as a natural end
    onPeriodEnd();
  }
}

function tick(){
  if (current.remaining <= 0){
    onPeriodEnd();
    return;
  }
  current.remaining--;
  updateDisplay();
  updateRing();
}

function onPeriodEnd(){
  pauseTimer();
  playBellIfAllowed();

  // switch mode (use internal keys: 'work' | 'short' | 'long')
  if (current.mode === 'work'){
    current.cycles++;
    const useLong = (current.cycles % settings.cyclesBeforeLong) === 0;
    current.mode = useLong ? 'long' : 'short';
  } else {
    current.mode = 'work';
  }

  current.remaining = settingsDurationFor(current.mode) * 60;
  updateCycleLabel();
  updateModeLabel();
  updateDisplay();
  updateRing();

  if (settings.autoStart){
    setTimeout(()=> startTimer(), 500); // small delay
  }
}

function settingsDurationFor(mode){
  return mode === 'work' ? settings.work : (mode === 'short' ? settings.short : settings.long);
}

function updateDisplay(){
  els.timeDisplay.textContent = formatTime(current.remaining);
  const label = MODE_LABELS[current.mode] || capitalize(current.mode);
  document.title = `${formatTime(current.remaining)} — ${label}`;
}

function updateModeLabel(){
  els.modeLabel.textContent = MODE_LABELS[current.mode] || capitalize(current.mode);
  els.modeLabel.setAttribute('aria-live','polite');
}

function updateCycleLabel(){
  els.cyclesLabel.textContent = `Cycles: ${current.cycles}`;
}

function updateRing(){
  const total = settingsDurationFor(current.mode) * 60;
  const progress = Math.max(0, Math.min(1, (total - current.remaining) / total));
  const offset = circumference - progress * circumference;
  ring.style.strokeDashoffset = offset;
}

function playBellIfAllowed(){
  if (!settings.sound) return;
  const audio = els.bellAudio;
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(()=>{ /* autoplay blocked — user will hear next time */ });
}

function saveSettings(){
  // read inputs
  const w = parseInt(els.workInput.value,10) || defaults.work;
  const s = parseInt(els.shortInput.value,10) || defaults.short;
  const l = parseInt(els.longInput.value,10) || defaults.long;
  const cb = parseInt(els.cyclesBeforeLong.value,10) || defaults.cyclesBeforeLong;
  const sound = !!els.soundToggle.checked;
  const autoStart = !!els.autoStartToggle.checked;

  settings = { work: w, short: s, long: l, cyclesBeforeLong: cb, sound, autoStart };
  localStorage.setItem('pomodoro.settings', JSON.stringify(settings));

  // if timer is not running, reset current remaining to reflect changed durations
  if (!current.running){
    current.remaining = settingsDurationFor(current.mode) * 60;
  }

  openModal(false);
  updateDisplay();
  updateRing();
}

function loadSettings(){
  const stored = localStorage.getItem('pomodoro.settings');
  if (!stored) return { ...defaults };
  try {
    const parsed = JSON.parse(stored);
    return {...defaults, ...parsed};
  } catch (e){
    return {...defaults};
  }
}

function openModal(open = true){
  els.settingsModal.setAttribute('aria-hidden', (!open).toString());
}

function formatTime(sec){
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

function saveState(){
  const st = {
    current,
    settings
  };
  try{ localStorage.setItem('pomodoro.state', JSON.stringify(st)); }catch(e){}
}

// initial render
updateRing();

