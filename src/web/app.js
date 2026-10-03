const inboxSelect = document.getElementById("inboxSelect");
const copyBtn = document.getElementById("copyBtn");
const refreshBtn = document.getElementById("refreshBtn");
const newBtn = document.getElementById("newBtn");
const deleteBtn = document.getElementById("deleteBtn");
const newBox = document.getElementById("newBox");
const closeNewBtn = document.getElementById("closeNewBtn");
const createCustomBtn = document.getElementById("createCustomBtn");
const createRandomBtn = document.getElementById("createRandomBtn");
const localPartInput = document.getElementById("localPartInput");
const domainSelect = document.getElementById("domainSelect");
const currentInbox = document.getElementById("currentInbox");
const messageCount = document.getElementById("messageCount");
const messageList = document.getElementById("messageList");
const appTitle = document.getElementById("appTitle");
const appSubtitle = document.getElementById("appSubtitle");
const autoRefreshBtn = document.getElementById("autoRefreshBtn");
const autoRefreshLabel = document.getElementById("autoRefreshLabel");

let appConfig = {
  appName: "BlipMail",
  mailDomain: "example.com",
  webHost: "blipmail.example.com",
};

const SESSION_KEY = "blipmail_session_id";
let sessionId = localStorage.getItem(SESSION_KEY) || "";
let autoRefreshTimer = null;

function icon(id, className = "i") {
  return `<svg class="${className}"><use href="#${id}"></use></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (sessionId) {
    headers["x-session-id"] = sessionId;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadConfig() {
  appConfig = await fetchJson("/api/config", { headers: {} });
  document.title = appConfig.appName;
  appTitle.textContent = appConfig.appName;
  appSubtitle.textContent = `Disposable inbox for ${appConfig.mailDomain}`;
  localPartInput.placeholder = `username (leave empty for random @${appConfig.mailDomain})`;

  const domains = appConfig.mailDomains || [appConfig.mailDomain];
  domainSelect.innerHTML = "";
  domains.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = `@${d}`;
    domainSelect.appendChild(opt);
  });
  if (domains.length <= 1) domainSelect.style.display = "none";
}

async function ensureSession() {
  const payload = await fetchJson("/api/session");
  sessionId = payload.sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
}

function renderEmpty(iconId, title, sub) {
  messageList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${icon(iconId)}</div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="sub">${sub}</div>
    </div>`;
}

async function loadInboxes(selectedAddress) {
  const inboxes = await fetchJson("/api/inboxes");
  inboxSelect.innerHTML = "";

  if (!inboxes.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No inbox yet";
    inboxSelect.appendChild(opt);
    currentInbox.textContent = "No inbox selected";
    messageCount.textContent = "0";
    renderEmpty(
      "i-inbox",
      "No inboxes yet",
      `Click <b>New</b> to create a disposable email address.`,
    );
    return;
  }

  inboxes.forEach((inbox) => {
    const opt = document.createElement("option");
    opt.value = inbox.address;
    opt.textContent = inbox.address;
    inboxSelect.appendChild(opt);
  });

  inboxSelect.value =
    selectedAddress && inboxes.some((x) => x.address === selectedAddress)
      ? selectedAddress
      : inboxes[0].address;

  await loadMessages();
}

async function loadMessages() {
  const address = inboxSelect.value;
  if (!address) return;
  currentInbox.textContent = address;
  const messages = await fetchJson(
    `/api/inboxes/${encodeURIComponent(address)}/messages`,
  );
  messageCount.textContent = String(messages.length);

  if (!messages.length) {
    renderEmpty(
      "i-mail",
      "Inbox empty",
      "Emails sent to this address will appear here.",
    );
    return;
  }

  messageList.innerHTML = messages
    .map(
      (msg) => `
    <article class="message-item">
      <button class="message-summary" type="button">
        <span class="message-avatar">${icon("i-user")}</span>
        <span class="message-summary-text">
          <span class="message-from">${escapeHtml(msg.from_address)}</span>
          <span class="message-subject">${escapeHtml(msg.subject || "(no subject)")}</span>
        </span>
        <span class="message-time">${escapeHtml(new Date(msg.received_at + "Z").toLocaleString())}</span>
        <span class="message-toggle">${icon("i-chevron")}</span>
      </button>
      <div class="message-body">
        <pre>${escapeHtml(msg.body)}</pre>
      </div>
    </article>
  `,
    )
    .join("");
}

function showToast(text, iconId = "i-check") {
  const tc = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${icon(iconId)}<span>${escapeHtml(text)}</span>`;
  tc.appendChild(el);
  setTimeout(() => {
    el.classList.add("fadeout");
    setTimeout(() => el.remove(), 200);
  }, 1800);
}

copyBtn.addEventListener("click", async () => {
  if (!inboxSelect.value) {
    showToast("No inbox to copy", "i-alert");
    return;
  }
  try {
    await navigator.clipboard.writeText(inboxSelect.value);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = inboxSelect.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast("Copied to clipboard", "i-check");
});

refreshBtn.addEventListener("click", loadMessages);
newBtn.addEventListener("click", () => {
  newBox.classList.toggle("hidden");
  if (!newBox.classList.contains("hidden")) localPartInput.focus();
});
closeNewBtn.addEventListener("click", () => newBox.classList.add("hidden"));
inboxSelect.addEventListener("change", loadMessages);

messageList.addEventListener("click", (e) => {
  const summary = e.target.closest(".message-summary");
  if (!summary) return;
  summary.parentElement.classList.toggle("open");
});

deleteBtn.addEventListener("click", async () => {
  if (!inboxSelect.value) return;
  if (!confirm(`Delete inbox ${inboxSelect.value}?`)) return;
  const target = inboxSelect.value;
  await fetchJson(`/api/inboxes/${encodeURIComponent(target)}`, {
    method: "DELETE",
  });
  showToast("Inbox removed", "i-trash");
  await loadInboxes();
});

createCustomBtn.addEventListener("click", async () => {
  const localPart = localPartInput.value.trim();
  const domain = domainSelect.value;
  try {
    const inbox = await fetchJson("/api/inboxes", {
      method: "POST",
      body: JSON.stringify({ localPart, domain }),
    });
    localPartInput.value = "";
    showToast("Inbox created", "i-check");
    await loadInboxes(inbox.address);
    newBox.classList.add("hidden");
  } catch (err) {
    showToast("Failed to create inbox", "i-alert");
    console.error(err);
  }
});

createRandomBtn.addEventListener("click", async () => {
  const domain = domainSelect.value;
  try {
    const inbox = await fetchJson("/api/inboxes", {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
    localPartInput.value = "";
    showToast("Random inbox created", "i-check");
    await loadInboxes(inbox.address);
    newBox.classList.add("hidden");
  } catch (err) {
    showToast("Failed to create inbox", "i-alert");
    console.error(err);
  }
});

autoRefreshBtn.addEventListener("click", () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
    autoRefreshBtn.classList.remove("active");
    autoRefreshLabel.textContent = "Auto: off";
    return;
  }
  autoRefreshTimer = setInterval(() => {
    loadMessages().catch(() => {});
  }, 10000);
  autoRefreshBtn.classList.add("active");
  autoRefreshLabel.textContent = "Auto: on";
  showToast("Auto-refresh enabled", "i-zap");
});

Promise.all([loadConfig(), ensureSession()])
  .then(() => loadInboxes())
  .catch((err) => {
    console.error(err);
    renderEmpty(
      "i-alert",
      "Connection error",
      escapeHtml(err.message),
    );
  });