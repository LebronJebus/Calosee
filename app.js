/****************************
 *  CONSTANTS / STATE       *
 ***************************/
let GOAL = 2300;
let TDEE = 1850;
let BMR  = 1850;

const PROT_GOAL = 150;
const FAT_GOAL  = 70;
const CARB_GOAL = 250;

/* today’s running totals */
let consumedToday = 0;
let proteinToday  = 0;
let fatToday      = 0;
let carbsToday    = 0;

/* seven-day history, oldest → newest
 * { date:"YYYY-MM-DD", calories, protein, fat, carbs }
 */
const dailyHistory = [];

/****************************
 *  HELPERS                 *
 ***************************/
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate  = d => `${d.getMonth() + 1}/${d.getDate()}`; // “M/D”

function safeEl(id) { return document.getElementById(id); }
function safeQuery(sel) { return document.querySelector(sel); }

/****************************
 *  RING ANIMATION LOGIC    *
 ***************************/
function updateRing(el, progress) {
  if (!el) return;
  const cappedProgress = Math.min(Math.max(Number(progress) || 0, 0), 1);
  const targetDeg = cappedProgress * 360;
  const currentDeg = parseFloat(el.style.getPropertyValue("--deg") || "0");
  const dur = 800;
  const start = performance.now();

  (function anim(t0) {
    const t = Math.min((t0 - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const deg = currentDeg + (targetDeg - currentDeg) * eased;
    el.style.setProperty("--deg", `${deg}deg`);

    // If over goal, set the over-deg separately
    if (progress > 1) {
      const overDeg = (progress - 1) * 360 * eased;
      el.style.setProperty("--over-deg", `${overDeg}deg`);
    } else {
      el.style.setProperty("--over-deg", `0deg`);
    }

    if (t < 1) requestAnimationFrame(anim);
  })(start);

  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

/****************************
 *  NET / DAILY            *
 ***************************/
function updateNet() {
  const diff  = TDEE - consumedToday;
  const label = diff < 0 ? "Surplus" : diff > 0 ? "Deficit" : "Even";
  const sign  = diff > 0 ? "+" : "";
  const netLine = safeEl("netLine");
  if (netLine) netLine.innerText = `${label}: ${sign}${diff}`;
}

function updateConsumed(add = 0) {
  consumedToday += Number(add) || 0;
  const consumedEl = safeEl("consumedValue");
  if (consumedEl) consumedEl.innerText = consumedToday;
  updateRing(safeEl("dailyCircle"), consumedToday / GOAL);
  updateNet();
}

function updateMacros() {
  [
    { id:"proteinRing", val:proteinToday, goal:PROT_GOAL, out:"proteinValue" },
    { id:"fatRing",     val:fatToday,     goal:FAT_GOAL,  out:"fatValue"    },
    { id:"carbRing",    val:carbsToday,   goal:CARB_GOAL, out:"carbValue"   }
  ].forEach(({id,val,goal,out})=>{
    updateRing(safeEl(id), val / goal);
    const outEl = safeEl(out);
    if (outEl) outEl.innerText = `${val} g`;
  });
}

/****************************
 *  WEEKLY CHART            *
 ***************************/
function renderWeekly() {
  const container = safeEl("weeklyChart");
  if (container) container.innerHTML = "";

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const entry = dailyHistory.find(e => e.date === iso) || {
      date: iso, calories: 0, protein: 0, fat: 0, carbs: 0
    };
    return { ...entry, deficit: TDEE - entry.calories, dateObj: d };
  });

  const max = Math.max(...days.map(d => d.calories), GOAL, TDEE, 1);

  days.forEach(d => {
    const col = document.createElement("div");
    col.className = "bar-col";

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${(d.calories / max) * 100}%`;
    bar.style.setProperty("--tdee-percent", `${(TDEE / max) * 100}%`);
    bar.dataset.date = fmtDate(d.dateObj);

    const info = document.createElement("div");
    info.className = "bar-info";
    const sign = d.deficit > 0 ? "+" : "";
    info.innerHTML = (d === days.at(-1) && d.calories === 0)
      ? ""
      : `${d.calories}<br>${sign}${d.deficit}`;

    col.appendChild(bar);
    col.appendChild(info);
    if (container) container.appendChild(col);
  });

  // Filter only days with data
  const validDays = days.filter(d => d.calories > 0);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length || 0;

  const avgCal = Math.round(avg(validDays.map(d => d.calories)));
  const avgProt = Math.round(avg(validDays.map(d => d.protein)));
  const avgFat = Math.round(avg(validDays.map(d => d.fat)));
  const avgCarbs = Math.round(avg(validDays.map(d => d.carbs)));

  const avgDiff = TDEE - avgCal;
  const netLbl = avgDiff < 0 ? "Surplus" : avgDiff > 0 ? "Deficit" : "Even";
  const netSign = avgDiff > 0 ? "+" : "";

  const avgCalBar = safeEl("avgCalorieBar");
  const goalLine = safeQuery(".goal-line");
  const tdeeLine = safeQuery(".tdee-line");

  if (avgCalBar) avgCalBar.style.width = `${Math.min(avgCal / max, 1) * 100}%`;
  if (goalLine) goalLine.style.left = `${(GOAL / max) * 100}%`;
  if (tdeeLine) tdeeLine.style.left = `${(TDEE / max) * 100}%`;

  const avgLabel = safeEl("avgLabel");
  const goalLabel = safeEl("goalLabel");
  const deficitLabel = safeEl("deficitLabel");

  if (avgLabel) avgLabel.textContent = `Average: ${avgCal} kcal`;
  if (goalLabel) goalLabel.textContent = `Goal: ${GOAL} kcal`;
  if (deficitLabel) deficitLabel.textContent = `${netLbl}: ${netSign}${avgDiff}`;

  // Weekly Macro Ring Animations
  updateRing(safeEl("weeklyProteinRing"), avgProt / PROT_GOAL);
  updateRing(safeEl("weeklyFatRing"),     avgFat / FAT_GOAL);
  updateRing(safeEl("weeklyCarbRing"),    avgCarbs / CARB_GOAL);

  const wp = safeEl("weeklyProteinValue");
  const wf = safeEl("weeklyFatValue");
  const wc = safeEl("weeklyCarbValue");

  if (wp) wp.innerText = `${avgProt} g`;
  if (wf) wf.innerText = `${avgFat} g`;
  if (wc) wc.innerText = `${avgCarbs} g`;
}

/****************************
 *  ENTRY HANDLER           *
 ***************************/
function addEntry({calories=0, protein=0, fat=0, carb=0, carbs=0} = {}) {
  // normalize carb/carbs
  const addedCarbs = +(carb || carbs || 0);

  // update running totals for today
  updateConsumed(+calories);
  proteinToday += +protein;
  fatToday     += +fat;
  carbsToday   += addedCarbs;
  updateMacros();

  // make sure today's object exists
  const iso = todayISO();
  let entry = dailyHistory.find(e => e.date === iso);
  if (!entry) {
    entry = { date: iso, calories: 0, protein: 0, fat: 0, carbs: 0 };
    dailyHistory.push(entry);
  }
  Object.assign(entry, {
    calories: consumedToday,
    protein : proteinToday,
    fat     : fatToday,
    carbs   : carbsToday
  });

  // keep only last 7 days
  while (dailyHistory.length > 7) dailyHistory.shift();

  renderWeekly();
}

/****************************
 *  CONFIRMATION MODAL      *
 ***************************/
function showConfirmation(macros) {
  return new Promise(resolve => {
    const modal = safeEl("confirmationModal");
    const yesBtn = safeEl("confirmYes");
    const noBtn  = safeEl("confirmNo");
    if (!modal || !yesBtn || !noBtn) return resolve(null);

    // pre-fill (guard each element)
    const fFood = safeEl("confirmFood");
    const fCal  = safeEl("confirmCalories");
    const fProt = safeEl("confirmProtein");
    const fFat  = safeEl("confirmFat");
    const fCarb = safeEl("confirmCarb");

    if (fFood) fFood.value = macros.food || "";
    if (fCal)  fCal.value  = macros.calories || 0;
    if (fProt) fProt.value = macros.protein  || 0;
    if (fFat)  fFat.value  = macros.fat      || 0;
    if (fCarb) fCarb.value = macros.carb     || 0;

    modal.classList.remove("hidden", "hide"); modal.classList.add("show");

    function cleanup(result) {
      modal.classList.remove("show"); modal.classList.add("hide");
      setTimeout(() => modal.classList.add("hidden"), 450);
      yesBtn.onclick = noBtn.onclick = null;
      resolve(result);
    }

    yesBtn.onclick = () => cleanup({
      food:     fFood ? fFood.value : "",
      calories: fCal  ? parseFloat(fCal.value) : 0,
      protein:  fProt ? parseFloat(fProt.value) : 0,
      fat:      fFat  ? parseFloat(fFat.value) : 0,
      carb:     fCarb ? parseFloat(fCarb.value) : 0,
    });
    noBtn.onclick  = () => cleanup(null);
  });
}

function showExerciseConfirmation(exercise) {
  return new Promise(resolve => {
    const modal = safeEl("exerciseModal");
    const yesBtn = safeEl("exerciseYes");
    const noBtn  = safeEl("exerciseNo");
    if (!modal || !yesBtn || !noBtn) return resolve(null);

    const nameEl = safeEl("exerciseName");
    const calEl  = safeEl("exerciseCalories");

    if (nameEl) nameEl.value = exercise.name || "";
    if (calEl)  calEl.value  = exercise.calories || 0;

    modal.classList.remove("hidden", "hide"); modal.classList.add("show");

    function cleanup(result) {
      modal.classList.remove("show"); modal.classList.add("hide");
      setTimeout(() => modal.classList.add("hidden"), 450);
      yesBtn.onclick = noBtn.onclick = null;
      resolve(result);
    }

    yesBtn.onclick = () => cleanup({
      name: nameEl ? nameEl.value : "",
      calories: calEl ? parseFloat(calEl.value) : 0
    });
    noBtn.onclick  = () => cleanup(null);
  });
}

/****************************
 *  BATCH CONFIRMATION FOR CHAT RESULTS
 ***************************/
function showBatchConfirmation(type, items) {
  return new Promise(resolve => {
    const modal = safeEl("batchModal");
    const title = safeEl("batchModalTitle");
    const list  = safeEl("batchList");
    const yesBtn = safeEl("batchYes");
    const noBtn  = safeEl("batchNo");
    if (!modal || !title || !list || !yesBtn || !noBtn) return resolve(false);

    title.innerText = type === "food" ? "Confirm Food Entries" : "Confirm Exercise Entries";
    list.innerHTML = "";

    if (type === "food") {
      items.forEach((item, i) => {
        const div = document.createElement("div");
        div.innerHTML = `
          <strong>${i+1}. ${item.food}</strong><br>
          Calories: ${item.calories} kcal, Protein: ${item.protein}g, Fat: ${item.fat}g, Carbs: ${item.carb || item.carbs || 0}g
          <hr style="border:0.5px solid rgba(255,255,255,0.2); margin:8px 0;">
        `;
        list.appendChild(div);
      });
    } else if (type === "exercise") {
      items.forEach((item, i) => {
        const div = document.createElement("div");
        div.innerHTML = `
          <strong>${i+1}. ${item.name}</strong><br>
          Calories Burned: ${item.calories} kcal
          <hr style="border:0.5px solid rgba(255,255,255,0.2); margin:8px 0;">
        `;
        list.appendChild(div);
      });
    }

    modal.classList.remove("hidden", "hide"); modal.classList.add("show");

    function cleanup(result) {
      modal.classList.remove("show"); modal.classList.add("hide");
      setTimeout(() => modal.classList.add("hidden"), 450);
      yesBtn.onclick = noBtn.onclick = null;
      resolve(result);
    }

    yesBtn.onclick = () => cleanup(true);
    noBtn.onclick  = () => cleanup(false);
  });
}

/****************************
 *  ChatGPT INTEGRATION     *
 *  NOTE: Do not put secrets in client-side JS. Use a server-side proxy.
 ***************************/
async function sendMessage() {
  const inputEl = safeEl("userInput");
  const chatBox = safeEl("chatBox");
  const userText = inputEl ? inputEl.value.trim() : "";
  if (!userText) return;

  if (chatBox) {
    chatBox.innerHTML += `<div class="message user"><strong>You:</strong> ${userText}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  if (inputEl) inputEl.value = "";

  try {
    // IMPORTANT: This endpoint should be implemented server-side.
    // The server should call OpenAI with the secret key and return the assistant response.
    const response = await fetch("https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions/chat", ...)
, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Return JSON with type ('food'|'exercise') and items: array of {food|name, calories, protein, fat, carb}." },
          { role: "user",   content: userText }
        ]
      })
    });

    const data = await response.json();
    // Accept either OpenAI-style or server-wrapped reply
    const reply = data.choices?.[0]?.message?.content?.trim() ?? data.reply ?? "";

    let result;
    try { result = JSON.parse(reply); }
    catch (err) { throw new Error(`Could not parse JSON from assistant: ${reply}`); }

    if (!result.type || !Array.isArray(result.items)) {
      throw new Error("API response missing required fields.");
    }

    const confirmed = await showBatchConfirmation(result.type, result.items);
    if (confirmed) {
      if (result.type === "food") {
        result.items.forEach(item => addEntry(item));
        if (chatBox) chatBox.innerHTML += `<div class="message bot"><strong>Foods Logged:</strong><br>${
          result.items.map((item,i)=> `${i+1}. ${item.food} (${item.calories} kcal)`).join("<br>")
        }</div>`;
      } else if (result.type === "exercise") {
        result.items.forEach(item => {
          TDEE += Number(item.calories) || 0;
        });
        const tdeeEl = safeEl("tdeeValue");
        if (tdeeEl) tdeeEl.innerText = TDEE;
        updateNet();
        renderWeekly();
        if (chatBox) chatBox.innerHTML += `<div class="message bot"><strong>Exercises Logged:</strong><br>${
          result.items.map((item,i)=> `${i+1}. ${item.name} burned ${item.calories} kcal`).join("<br>")
        }</div>`;
      }
    } else {
      if (chatBox) chatBox.innerHTML += `<div class="message bot"><strong>Entries cancelled.</strong></div>`;
    }

    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

  } catch (err) {
    console.error("API error", err);
    if (chatBox) {
      chatBox.innerHTML += `<div class="message bot"><strong>Error:</strong> ${err.message}</div>`;
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }
}

/****************************
 *  DOM READY               *
 ***************************/
window.addEventListener("DOMContentLoaded", () => {
  // wire up UI controls safely (guard missing elements)
  const setWeightSlider = safeEl("setWeight");
  const setHeightSlider = safeEl("setHeight");
  const setAgeSlider    = safeEl("setAge");
  const setGoalSlider   = safeEl("setGoalCalories");

  const setWeightDisplay = safeEl("setWeightDisplay");
  const setHeightDisplay = safeEl("setHeightDisplay");
  const setAgeDisplay    = safeEl("setAgeDisplay");
  const setGoalDisplay   = safeEl("setGoalDisplay");

  if (setWeightSlider && setWeightDisplay) setWeightSlider.oninput = () => setWeightDisplay.textContent = `${setWeightSlider.value} lb`;
  if (setHeightSlider && setHeightDisplay) setHeightSlider.oninput = () => setHeightDisplay.textContent = `${setHeightSlider.value} in`;
  if (setAgeSlider && setAgeDisplay)       setAgeSlider.oninput    = () => setAgeDisplay.textContent    = `${setAgeSlider.value}`;
  if (setGoalSlider && setGoalDisplay)     setGoalSlider.oninput   = () => setGoalDisplay.textContent   = `${setGoalSlider.value} kcal`;

  function loadSettings() {
    const userName = safeEl("userName");
    const obSex = safeEl("obSex");
    if (safeEl("setName") && userName) safeEl("setName").value = userName.innerText || "";
    if (safeEl("setSex") && obSex) safeEl("setSex").value = obSex.value || "";
    if (setWeightSlider && safeEl("obWeight")) setWeightSlider.value = safeEl("obWeight").value;
    if (setHeightSlider && safeEl("obHeight")) setHeightSlider.value = safeEl("obHeight").value;
    if (setAgeSlider && safeEl("obAge"))       setAgeSlider.value    = safeEl("obAge").value;
    if (setGoalSlider)                         setGoalSlider.value   = GOAL;

    if (setWeightDisplay) setWeightDisplay.textContent = `${setWeightSlider ? setWeightSlider.value : ""} lb`;
    if (setHeightDisplay) setHeightDisplay.textContent = `${setHeightSlider ? setHeightSlider.value : ""} in`;
    if (setAgeDisplay)    setAgeDisplay.textContent    = `${setAgeSlider ? setAgeSlider.value : ""}`;
    if (setGoalDisplay)   setGoalDisplay.textContent   = `${setGoalSlider ? setGoalSlider.value : GOAL} kcal`;
  }

  const saveSettingsBtn = safeEl("saveSettings");
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", () => {
      const nameEl = safeEl("setName");
      const sexEl = safeEl("setSex");
      const name   = (nameEl ? (nameEl.value || "User").trim() : "User");
      const sex    = sexEl ? sexEl.value : "male";
      const weight = setWeightSlider ? +setWeightSlider.value : 0;
      const height = setHeightSlider ? +setHeightSlider.value : 0;
      const age    = setAgeSlider ? +setAgeSlider.value : 0;
      GOAL         = setGoalSlider ? +setGoalSlider.value : GOAL;

      if (!weight || !height || !age) {
        // still allow but avoid NaN
      }

      const kg = weight * 0.453592;
      const cm = height * 2.54;
      BMR  = Math.round(
              sex === "male"
                ? 10 * kg + 6.25 * cm - 5 * age + 5
                : 10 * kg + 6.25 * cm - 5 * age - 161
            );
      TDEE = Math.round(BMR * 1.45);

      const userName = safeEl("userName");
      const tdeeVal = safeEl("tdeeValue");
      const goalVal = safeEl("goalValue");

      if (userName) userName.innerText  = name;
      if (tdeeVal) tdeeVal.innerText = TDEE;
      if (goalVal) goalVal.innerText = GOAL;

      const dailyCircle = safeEl("dailyCircle");
      if (dailyCircle) {
        const bmrDeg = (BMR / GOAL) * 360;
        dailyCircle.style.setProperty("--bmr-deg", `${bmrDeg}deg`);
      }

      updateNet();
      renderWeekly();
    });
  }

  // initial load
  loadSettings();

  // Ensure UI is initialized safely after loading settings
  updateMacros();
  updateConsumed(0);
  renderWeekly();

  // onboarding wiring (guard)
  const weightSlider = safeEl("obWeight");
  const heightSlider = safeEl("obHeight");
  const ageSlider    = safeEl("obAge");
  const goalSlider   = safeEl("obGoalCalories");

  const weightDisplay = safeEl("weightDisplay");
  const heightDisplay = safeEl("heightDisplay");
  const ageDisplay    = safeEl("ageDisplay");
  const goalDisplay   = safeEl("goalDisplay");

  if (weightSlider && weightDisplay) weightSlider.oninput = () => weightDisplay.textContent = `${weightSlider.value} lb`;
  if (heightSlider && heightDisplay) heightSlider.oninput = () => heightDisplay.textContent = `${heightSlider.value} in`;
  if (ageSlider && ageDisplay)       ageSlider.oninput    = () => ageDisplay.textContent    = `${ageSlider.value}`;
  if (goalSlider && goalDisplay)     goalSlider.oninput   = () => goalDisplay.textContent   = `${goalSlider.value} kcal`;

  if (document.body) document.body.classList.add("bright-bg");

  const obStart = safeEl("obStart");
  if (obStart) {
    obStart.addEventListener("click", () => {
      const name   = (safeEl("obName") ? (safeEl("obName").value || "User").trim() : "User");
      const sex    = safeEl("obSex") ? safeEl("obSex").value : "male";
      const weight = weightSlider ? +weightSlider.value : 0;
      const height = heightSlider ? +heightSlider.value : 0;
      const age    = ageSlider    ? +ageSlider.value    : 0;
      GOAL         = goalSlider   ? +goalSlider.value   : GOAL;

      if (!weight || !height || !age || !GOAL) return;

      const kg = weight * 0.453592;
      const cm = height * 2.54;
      BMR  = Math.round(
              sex === "male"
                ? 10 * kg + 6.25 * cm - 5 * age + 5
                : 10 * kg + 6.25 * cm - 5 * age - 161
            );
      TDEE = Math.round(BMR * 1.45);

      const userName = safeEl("userName");
      const tdeeVal = safeEl("tdeeValue");
      const goalVal = safeEl("goalValue");

      if (userName) userName.innerText  = name;
      if (tdeeVal) tdeeVal.innerText = TDEE;
      if (goalVal) goalVal.innerText = GOAL;

      const dailyCircle = safeEl("dailyCircle");
      if (dailyCircle) {
        const bmrDeg = (BMR / GOAL) * 360;
        dailyCircle.style.setProperty("--bmr-deg", `${bmrDeg}deg`);
      }

      const onboardingModal = safeEl("onboardingModal");
      const appMain = safeEl("appMain");
      if (onboardingModal) onboardingModal.classList.add("hidden");
      if (appMain) appMain.classList.remove("hidden");
      if (document.body) document.body.classList.remove("bright-bg");

      // start the log with today (all zeros)
      dailyHistory.push({ date: todayISO(), calories: 0, protein: 0, fat: 0, carbs: 0 });
      updateConsumed(0);
      updateMacros();
      renderWeekly();
    });
  }

  // If there's a chat send button, wire it to sendMessage
  const chatSend = safeEl("chatSend");
  if (chatSend) chatSend.addEventListener("click", sendMessage);

  // also allow pressing Enter in input to send (if present)
  const userInput = safeEl("userInput");
  if (userInput) {
    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });
  }
});
