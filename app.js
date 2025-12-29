/****************************
 *  CaloSee Core            *
 ***************************/

// Global state (existing)
let consumedToday = 0;
let proteinToday  = 0;
let fatToday      = 0;
let carbsToday    = 0;

let GOAL = 2200; // default, can be overwritten by settings/onboarding
let TDEE = 2400; // default, can be overwritten by onboarding

const dailyHistory = [];

/****************************
 *  HELPERS                 *
 ***************************/
const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDateLabel = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

function safeEl(id) {
  return document.getElementById(id);
}

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/****************************
 *  RING + UI UTILS         *
 ***************************/
function updateRing(el, pct = 0) {
  if (!el) return;
  const p = Math.max(0, Math.min(1, pct));
  el.style.setProperty("--pct", p);
}

function pulse(el) {
  if (!el) return;
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

/****************************
 *  NET / DAILY             *
 ***************************/
function updateNet() {
  const diff  = TDEE - consumedToday;
  const label = diff < 0 ? "Surplus" : "Remaining";
  const netEl = safeEl("netValue");
  const labEl = safeEl("netLabel");
  if (labEl) labEl.innerText = label;
  if (netEl) netEl.innerText = Math.abs(Math.round(diff));
}

function updateConsumed(add = 0) {
  consumedToday += Number(add) || 0;
  const consumedEl = safeEl("consumedValue");
  if (consumedEl) consumedEl.innerText = consumedToday;
  updateRing(safeEl("dailyCircle"), consumedToday / GOAL);
  updateNet();
}

/****************************
 *  MACROS                  *
 ***************************/
function updateMacros() {
  // Daily macro rings (goals are constants in your existing code)
  const PROT_GOAL = 200;
  const FAT_GOAL  = 80;
  const CARB_GOAL = 200;

  // update macro rings
  updateRing(safeEl("proteinRing"), proteinToday / PROT_GOAL);
  updateRing(safeEl("fatRing"),     fatToday / FAT_GOAL);
  updateRing(safeEl("carbRing"),    carbsToday / CARB_GOAL);

  // update macro values
  const p = safeEl("proteinValue");
  const f = safeEl("fatValue");
  const c = safeEl("carbValue");

  if (p) p.innerText = `${Math.round(proteinToday)} g`;
  if (f) f.innerText = `${Math.round(fatToday)} g`;
  if (c) c.innerText = `${Math.round(carbsToday)} g`;

  // update weekly macro rings too
  renderWeekly();
}

/****************************
 *  WEEKLY                  *
 ***************************/
function renderWeekly() {
  // Build a 7-day view including today
  const today = todayISO();
  const last7 = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);

    const found = dailyHistory.find(x => x.date === iso);
    last7.push(found || { date: iso, calories: 0, protein: 0, fat: 0, carbs: 0 });
  }

  // Update chart columns (if present)
  const chart = safeEl("weeklyChart");
  if (chart) {
    chart.innerHTML = "";
    last7.forEach((d, idx) => {
      const col = document.createElement("div");
      col.className = "weeklyCol";

      const bar = document.createElement("div");
      bar.className = "weeklyBar";

      const pct = GOAL ? (d.calories / GOAL) : 0;
      bar.style.height = `${Math.max(0, Math.min(1, pct)) * 100}%`;

      const lab = document.createElement("div");
      lab.className = "weeklyLabel";
      lab.innerText = fmtDateLabel(d.date);

      col.appendChild(bar);
      col.appendChild(lab);
      chart.appendChild(col);
    });
  }

  // Weekly averages
  const sum = last7.reduce((acc, d) => {
    acc.calories += d.calories;
    acc.protein  += d.protein;
    acc.fat      += d.fat;
    acc.carbs    += d.carbs;
    return acc;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const avgCal   = Math.round(sum.calories / 7);
  const avgProt  = Math.round(sum.protein / 7);
  const avgFat   = Math.round(sum.fat / 7);
  const avgCarbs = Math.round(sum.carbs / 7);

  const avgLabel = safeEl("avgLabel");
  if (avgLabel) avgLabel.innerText = `${avgCal} avg / day`;

  const avgBar = safeEl("avgCalorieBar");
  if (avgBar) avgBar.style.width = `${Math.max(0, Math.min(1, avgCal / GOAL)) * 100}%`;

  // Weekly macro rings
  const PROT_GOAL = 200;
  const FAT_GOAL  = 80;
  const CARB_GOAL = 200;

  updateRing(safeEl("weeklyProteinRing"), avgProt / PROT_GOAL);
  updateRing(safeEl("weeklyFatRing"),     avgFat  / FAT_GOAL);
  updateRing(safeEl("weeklyCarbRing"),    avgCarbs / CARB_GOAL);

  const wp = safeEl("weeklyProteinValue");
  const wf = safeEl("weeklyFatValue");
  const wc = safeEl("weeklyCarbValue");
  if (wp) wp.innerText = `${avgProt} g`;
  if (wf) wf.innerText = `${avgFat} g`;
  if (wc) wc.innerText = `${avgCarbs} g`;

  // Keep today at least present
  if (!dailyHistory.find(x => x.date === today)) {
    dailyHistory.push({ date: today, calories: consumedToday, protein: proteinToday, fat: fatToday, carbs: carbsToday });
  }
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
 *  MODALS / CONFIRMATION   *
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
          <strong>${i+1}. ${escapeHTML(item.food ?? "")}</strong><br>
          Calories: ${Number(item.calories || 0)} kcal,
          Protein: ${Number(item.protein || 0)}g,
          Fat: ${Number(item.fat || 0)}g,
          Carbs: ${Number((item.carb ?? item.carbs) || 0)}g
          <hr style="border:0.5px solid rgba(255,255,255,0.2); margin:8px 0;">
        `;
        list.appendChild(div);
      });
    } else if (type === "exercise") {
      items.forEach((item, i) => {
        const div = document.createElement("div");
        div.innerHTML = `
          <strong>${i+1}. ${escapeHTML(item.name ?? "")}</strong><br>
          Calories Burned: ${Number(item.calories || 0)} kcal
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
 *  GPT CHAT INTEGRATION    *
 ***************************/
function sendMessage() {
  const inputEl = safeEl("userInput");
  const chatBox = safeEl("chatBox");
  const userText = inputEl ? inputEl.value.trim() : "";
  if (!userText) return;

  // Echo user message
  if (chatBox) {
    chatBox.innerHTML += `<div class="message user"><strong>You:</strong> ${escapeHTML(userText)}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  if (inputEl) inputEl.value = "";

  // Strict schema prompt so the UI can parse reliably
  const SYSTEM_PROMPT = `
You are a nutrition and exercise logging assistant.

Return ONLY valid JSON (no markdown, no commentary) using EXACTLY this schema:

{
  "type": "food" | "exercise",
  "items": [
    {
      "food": string,
      "calories": number,
      "protein": number,
      "fat": number,
      "carb": number
    }
    // OR if type === "exercise":
    // { "name": string, "calories": number }
  ]
}

Rules:
- If multiple items are mentioned, include multiple objects.
- If exact values are unknown, estimate reasonably.
- Calories must always be a number.
`.trim();

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userText }
  ];

  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });

      const raw = await res.text();

      if (!res.ok) {
        console.error("API status:", res.status);
        console.error("API raw response:", raw);
        throw new Error(`API error ${res.status}: ${raw || "(empty body)"}`);
      }
      if (!raw.trim()) throw new Error("Empty response body from /api/chat");

      let serverJson;
      try {
        serverJson = JSON.parse(raw);
      } catch {
        console.error("Non-JSON response:", raw);
        throw new Error("Server returned non-JSON response");
      }

      const replyText = (serverJson.reply ?? "").trim();
      if (!replyText) throw new Error("Server response missing 'reply'");

      let result;
      try {
        result = JSON.parse(replyText);
      } catch {
        console.error("Assistant reply (not JSON):", replyText);
        throw new Error("Assistant returned invalid JSON. Try rephrasing your message.");
      }

      if (!result || !result.type || !Array.isArray(result.items)) {
        console.error("Malformed assistant JSON:", result);
        throw new Error("Assistant response missing required fields.");
      }

      const type = String(result.type).toLowerCase();
      const items = result.items.map(it => (it && typeof it === "object" ? it : {}));

      const confirmed = await showBatchConfirmation(type, items);
      if (!confirmed) {
        if (chatBox) {
          chatBox.innerHTML += `<div class="message bot"><strong>Calosee:</strong> Okay, I won’t log that.</div>`;
          chatBox.scrollTop = chatBox.scrollHeight;
        }
        return;
      }

      if (type === "food") {
        items.forEach((item) => {
          addEntry({
            calories: +item.calories || 0,
            protein:  +item.protein  || 0,
            fat:      +item.fat      || 0,
            carb:     +((item.carb ?? item.carbs) || 0) || 0
          });
        });

        if (chatBox) {
          chatBox.innerHTML += `<div class="message bot"><strong>Calosee:</strong> Logged food.</div>`;
          chatBox.scrollTop = chatBox.scrollHeight;
        }
      } else if (type === "exercise") {
        items.forEach((item) => {
          const burned = +item.calories || 0;

          // Exercise subtracts from consumed calories; does not change macros.
          updateConsumed(-burned);

          // Update today's history entry so weekly chart stays accurate
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

          while (dailyHistory.length > 7) dailyHistory.shift();
          renderWeekly();
        });

        if (chatBox) {
          chatBox.innerHTML += `<div class="message bot"><strong>Calosee:</strong> Logged exercise.</div>`;
          chatBox.scrollTop = chatBox.scrollHeight;
        }
      } else {
        throw new Error(`Unknown type '${type}'.`);
      }
    } catch (err) {
      console.error("GPT Error:", err);
      if (chatBox) {
        chatBox.innerHTML += `<div class="message bot error"><strong>Error:</strong> ${escapeHTML(err.message || String(err))}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
      } else {
        alert(err.message || "Something went wrong.");
      }
    }
  })();
}

/****************************
 *  INIT                    *
 ***************************/
(function init() {
  // Initialize UI values if elements exist
  const nameEl = safeEl("userName");
  if (nameEl && !nameEl.innerText) nameEl.innerText = "User";

  const consumedEl = safeEl("consumedValue");
  if (consumedEl) consumedEl.innerText = consumedToday;

  const tdeeEl = safeEl("tdeeValue");
  if (tdeeEl) tdeeEl.innerText = TDEE;

  updateRing(safeEl("dailyCircle"), 0);
  updateMacros();
  updateNet();
  renderWeekly();
})();
