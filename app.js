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
 *  HELPER FUNCTIONS        *
 ***************************/
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate  = d =>
  `${d.getMonth() + 1}/${d.getDate()}`;         // “M/D”

/****************************
 *  DOM READY               *
 ***************************/
window.addEventListener("DOMContentLoaded", () => {
/* ----- settings sliders ----- */
const setWeightSlider = document.getElementById("setWeight");
const setHeightSlider = document.getElementById("setHeight");
const setAgeSlider    = document.getElementById("setAge");
const setGoalSlider   = document.getElementById("setGoalCalories");

const setWeightDisplay = document.getElementById("setWeightDisplay");
const setHeightDisplay = document.getElementById("setHeightDisplay");
const setAgeDisplay    = document.getElementById("setAgeDisplay");
const setGoalDisplay   = document.getElementById("setGoalDisplay");

setWeightSlider.oninput = () => (setWeightDisplay.textContent = `${setWeightSlider.value} lb`);
setHeightSlider.oninput = () => (setHeightDisplay.textContent = `${setHeightSlider.value} in`);
setAgeSlider.oninput    = () => (setAgeDisplay.textContent    = `${setAgeSlider.value}`);
setGoalSlider.oninput   = () => (setGoalDisplay.textContent   = `${setGoalSlider.value} kcal`);

/* ----- populate settings from current ----- */
function loadSettings() {
  document.getElementById("setName").value = document.getElementById("userName").innerText;
  document.getElementById("setSex").value  = document.getElementById("obSex").value; // or keep your own state
  setWeightSlider.value = document.getElementById("obWeight").value;
  setHeightSlider.value = document.getElementById("obHeight").value;
  setAgeSlider.value    = document.getElementById("obAge").value;
  setGoalSlider.value   = GOAL;

  setWeightDisplay.textContent = `${setWeightSlider.value} lb`;
  setHeightDisplay.textContent = `${setHeightSlider.value} in`;
  setAgeDisplay.textContent    = `${setAgeSlider.value}`;
  setGoalDisplay.textContent   = `${setGoalSlider.value} kcal`;
}

/* ----- save settings button ----- */
document.getElementById("saveSettings").addEventListener("click", () => {
  const name   = (document.getElementById("setName").value || "User").trim();
  const sex    = document.getElementById("setSex").value;
  const weight = +setWeightSlider.value;
  const height = +setHeightSlider.value;
  const age    = +setAgeSlider.value;
  GOAL         = +setGoalSlider.value;

  /* recalc BMR/TDEE */
  const kg = weight * 0.453592;
  const cm = height * 2.54;
  BMR  = Math.round(
          sex === "male"
            ? 10 * kg + 6.25 * cm - 5 * age + 5
            : 10 * kg + 6.25 * cm - 5 * age - 161
        );
  TDEE = Math.round(BMR * 1.45);

  /* update UI */
  document.getElementById("userName").innerText  = name;
  document.getElementById("tdeeValue").innerText = TDEE;
  document.getElementById("goalValue").innerText = GOAL;

  const bmrDeg = (BMR / GOAL) * 360;
  document.getElementById("dailyCircle")
    .style.setProperty("--bmr-deg", `${bmrDeg}deg`);

  updateNet();
  renderWeekly();
});

/* ----- load on start ----- */
loadSettings();

/* Ensure UI is initialized safely after loading settings */
updateMacros();
updateConsumed(0);
renderWeekly();

  /* ----- onboarding sliders ----- */
  const weightSlider = document.getElementById("obWeight");
  const heightSlider = document.getElementById("obHeight");
  const ageSlider    = document.getElementById("obAge");
  const goalSlider   = document.getElementById("obGoalCalories");

  const weightDisplay = document.getElementById("weightDisplay");
  const heightDisplay = document.getElementById("heightDisplay");
  const ageDisplay    = document.getElementById("ageDisplay");
  const goalDisplay   = document.getElementById("goalDisplay");

  document.body.classList.add("bright-bg");

  weightSlider.oninput = () => (weightDisplay.textContent = `${weightSlider.value} lb`);
  heightSlider.oninput = () => (heightDisplay.textContent = `${heightSlider.value} in`);
  ageSlider.oninput    = () => (ageDisplay.textContent    = `${ageSlider.value}`);
  goalSlider.oninput   = () => (goalDisplay.textContent   = `${goalSlider.value} kcal`);

  /* ----- start button ----- */
  document.getElementById("obStart").addEventListener("click", () => {
    const name   = (document.getElementById("obName").value || "User").trim();
    const sex    = document.getElementById("obSex").value;
    const weight = +weightSlider.value;
    const height = +heightSlider.value;
    const age    = +ageSlider.value;
    GOAL         = +goalSlider.value;

    if (!weight || !height || !age || !GOAL) return;

    const kg = weight * 0.453592;
    const cm = height * 2.54;
    BMR  = Math.round(
            sex === "male"
              ? 10 * kg + 6.25 * cm - 5 * age + 5
              : 10 * kg + 6.25 * cm - 5 * age - 161
          );
    TDEE = Math.round(BMR * 1.45);

    /* UI updates */
    document.getElementById("userName").innerText  = name;
    document.getElementById("tdeeValue").innerText = TDEE;
    document.getElementById("goalValue").innerText = GOAL;

    const bmrDeg = (BMR / GOAL) * 360;
    document
      .getElementById("dailyCircle")
      .style.setProperty("--bmr-deg", `${bmrDeg}deg`);

    document.getElementById("onboardingModal").classList.add("hidden");
    document.getElementById("appMain").classList.remove("hidden");
    document.body.classList.remove("bright-bg");

    /* start the log with today (all zeros) */
    dailyHistory.push({ date: todayISO(), calories: 0, protein: 0, fat: 0, carbs: 0 });
    updateConsumed(0);
    updateMacros();
    renderWeekly();
  });
});

/****************************
 *  RING ANIMATION LOGIC    *
 ***************************/
function updateRing(el, progress) {
  if (!el) return;
  const cappedProgress = Math.min(progress, 1);
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
  const netLine = document.getElementById("netLine");
  if (netLine) netLine.innerText = `${label}: ${sign}${diff}`;
}

function updateConsumed(add) {
  consumedToday += add;
  const consumedEl = document.getElementById("consumedValue");
  if (consumedEl) consumedEl.innerText = consumedToday;
  updateRing(document.getElementById("dailyCircle"), consumedToday / GOAL);
  updateNet();
}

function updateMacros() {
  [
    { id:"proteinRing", val:proteinToday, goal:PROT_GOAL, out:"proteinValue" },
    { id:"fatRing",     val:fatToday,     goal:FAT_GOAL,  out:"fatValue"    },
    { id:"carbRing",    val:carbsToday,   goal:CARB_GOAL, out:"carbValue"   }
  ].forEach(({id,val,goal,out})=>{
    updateRing(document.getElementById(id), val / goal);
    const outEl = document.getElementById(out);
    if (outEl) outEl.innerText = `${val} g`;
  });
}

/****************************
 *  WEEKLY CHART            *
 ***************************/
function renderWeekly() {
  const container = document.getElementById("weeklyChart");
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
    bar.dataset.date = fmtDate(d.dateObj);          // ⬅️ new date location

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

  const avgCalBar = document.getElementById("avgCalorieBar");
  const goalLine = document.querySelector(".goal-line");
  const tdeeLine = document.querySelector(".tdee-line");

  if (avgCalBar) avgCalBar.style.width = `${Math.min(avgCal / max, 1) * 100}%`;
  if (goalLine) goalLine.style.left = `${(GOAL / max) * 100}%`;
  if (tdeeLine) tdeeLine.style.left = `${(TDEE / max) * 100}%`;

  const avgLabel = document.getElementById("avgLabel");
  const goalLabel = document.getElementById("goalLabel");
  const deficitLabel = document.getElementById("deficitLabel");

  if (avgLabel) avgLabel.textContent = `Average: ${avgCal} kcal`;
  if (goalLabel) goalLabel.textContent = `Goal: ${GOAL} kcal`;
  if (deficitLabel) deficitLabel.textContent = `${netLbl}: ${netSign}${avgDiff}`;

  // Weekly Macro Ring Animations (safe: get elements and update)
  updateRing(document.getElementById("weeklyProteinRing"), avgProt / PROT_GOAL);
  updateRing(document.getElementById("weeklyFatRing"),     avgFat / FAT_GOAL);
  updateRing(document.getElementById("weeklyCarbRing"),    avgCarbs / CARB_GOAL);

  const wp = document.getElementById("weeklyProteinValue");
  const wf = document.getElementById("weeklyFatValue");
  const wc = document.getElementById("weeklyCarbValue");

  if (wp) wp.innerText = `${avgProt} g`;
  if (wf) wf.innerText = `${avgFat} g`;
  if (wc) wc.innerText = `${avgCarbs} g`;
}

/****************************
 *  ENTRY HANDLER           *
 ***************************/
function addEntry({calories=0, protein=0, fat=0, carb=0, carbs=0}) {
  /* normalize carb/carbs */
  const addedCarbs = + (carb || carbs || 0);

  /* update running totals for today */
  updateConsumed(+calories);
  proteinToday += +protein;
  fatToday     += +fat;
  carbsToday   += addedCarbs;
  updateMacros();

  /* make sure today's object exists */
  const iso = todayISO();
  let entry = dailyHistory.find(e=>e.date===iso);
  if (!entry) {
    entry = { date:iso, calories:0, protein:0, fat:0, carbs:0 };
    dailyHistory.push(entry);
  }
  Object.assign(entry,{
    calories: consumedToday,
    protein : proteinToday,
    fat     : fatToday,
    carbs   : carbsToday
  });

  /* keep only last 7 days */
  while (dailyHistory.length > 7) dailyHistory.shift();

  renderWeekly();
}

/****************************
 *  CONFIRMATION MODAL      *
 ***************************/
function showConfirmation(macros) {
  return new Promise(resolve => {
    const modal = document.getElementById("confirmationModal");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn  = document.getElementById("confirmNo");

    /* pre-fill */
    document.getElementById("confirmFood").value     = macros.food     || "";
    document.getElementById("confirmCalories").value = macros.calories || 0;
    document.getElementById("confirmProtein").value  = macros.protein  || 0;
    document.getElementById("confirmFat").value      = macros.fat      || 0;
    document.getElementById("confirmCarb").value     = macros.carb     || 0;

    modal.classList.remove("hidden", "hide"); modal.classList.add("show");

    function cleanup(result) {
      modal.classList.remove("show"); modal.classList.add("hide");
      setTimeout(() => modal.classList.add("hidden"), 450);
      yesBtn.onclick = noBtn.onclick = null;
      resolve(result);
    }

    yesBtn.onclick = () => cleanup({
      food:     document.getElementById("confirmFood").value,
      calories: parseFloat(document.getElementById("confirmCalories").value),
      protein:  parseFloat(document.getElementById("confirmProtein").value),
      fat:      parseFloat(document.getElementById("confirmFat").value),
      carb:     parseFloat(document.getElementById("confirmCarb").value),
    });
    noBtn.onclick  = () => cleanup(null);
  });
}
function showExerciseConfirmation(exercise) {
  return new Promise(resolve => {
    const modal = document.getElementById("exerciseModal");
    const yesBtn = document.getElementById("exerciseYes");
    const noBtn  = document.getElementById("exerciseNo");

    document.getElementById("exerciseName").value = exercise.name || "";
    document.getElementById("exerciseCalories").value = exercise.calories || 0;

    modal.classList.remove("hidden", "hide"); modal.classList.add("show");

    function cleanup(result) {
      modal.classList.remove("show"); modal.classList.add("hide");
      setTimeout(() => modal.classList.add("hidden"), 450);
      yesBtn.onclick = noBtn.onclick = null;
      resolve(result);
    }

    yesBtn.onclick = () => cleanup({
      name: document.getElementById("exerciseName").value,
      calories: parseFloat(document.getElementById("exerciseCalories").value)
    });
    noBtn.onclick  = () => cleanup(null);
  });
}

/****************************
 *  ChatGPT INTEGRATION     *
 *  NOTE: Do not put secrets in client-side JS. Use a server-side proxy.
 ***************************/
async function sendMessage() {
  const inputEl = document.getElementById("userInput");
  const chatBox = document.getElementById("chatBox");
  const userText = inputEl.value.trim();
  if (!userText) return;

  chatBox.innerHTML += `<div class="message user"><strong>You:</strong> ${userText}</div>`;
  inputEl.value = ""; 
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    // IMPORTANT: Replace the client-side fetch with a call to your server which holds the API key.
    const response = await fetch("/api/chat", { // server-side endpoint that calls OpenAI
      method : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // server will use the proper model and the secret key
        messages: [
          { role: "system", content: "Return JSON with type ('food'|'exercise') and items: array of {food|name, calories, protein, fat, carb}." },
          { role: "user",   content: userText }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() ?? data.reply ?? "";

    let result;
    try { result = JSON.parse(reply); }
    catch (err) { throw new Error(`Could not parse JSON: ${reply}`); }

    if (!result.type || !Array.isArray(result.items)) {
      throw new Error("API response missing required fields.");
    }

    const confirmed = await showBatchConfirmation(result.type, result.items);
    if (confirmed) {
      if (result.type === "food") {
        result.items.forEach(item => addEntry(item));
        chatBox.innerHTML += `<div class="message bot"><strong>Foods Logged:</strong><br>${
          result.items.map((item,i)=> `${i+1}. ${item.food} (${item.calories} kcal)`).join("<br>")
        }</div>`;
      } else if (result.type === "exercise") {
        result.items.forEach(item => {
          TDEE += item.calories;
        });
        const tdeeEl = document.getElementById("tdeeValue");
        if (tdeeEl) tdeeEl.innerText = TDEE;
        updateNet();
        renderWeekly();
        chatBox.innerHTML += `<div class="message bot"><strong>Exercises Logged:</strong><br>${
          result.items.map((item,i)=> `${i+1}. ${item.name} burned ${item.calories} kcal`).join("<br>")
        }</div>`;
      }
    } else {
      chatBox.innerHTML += `<div class="message bot"><strong>Entries cancelled.</strong></div>`;
    }

    chatBox.scrollTop = chatBox.scrollHeight;

  } catch (err) {
    console.error("API error", err);
    chatBox.innerHTML += `<div class="message bot"><strong>Error:</strong> ${err.message}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}
function showBatchConfirmation(type, items) {
  return new Promise(resolve => {
    const modal = document.getElementById("batchModal");
    const title = document.getElementById("batchModalTitle");
    const list  = document.getElementById("batchList");
    const yesBtn = document.getElementById("batchYes");
    const noBtn  = document.getElementById("batchNo");

    title.innerText = type === "food" ? "Confirm Food Entries" : "Confirm Exercise Entries";
    list.innerHTML = "";

    if (type === "food") {
      items.forEach((item, i) => {
        const div = document.createElement("div");
        div.innerHTML = `
          <strong>${i+1}. ${item.food}</strong><br>
          Calories: ${item.calories} kcal, Protein: ${item.protein}g, Fat: ${item.fat}g, Carbs: ${item.carb || item.carbs}g
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
