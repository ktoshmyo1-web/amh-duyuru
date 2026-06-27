import { firebaseConfig, webPushPublicKey } from "./firebase-config.js";

const APP_VERSION = "20260625-clean-1";
const DEFAULT_ADMIN_PASSWORD = "135746";
const RESET_PIN = "1234";
const STUDENT_SESSION_KEY = "amh_v2_student_session";
const ADMIN_SESSION_KEY = "amh_v2_admin_session";

const state = {
  app: null,
  db: null,
  fs: null,
  adminPassword: DEFAULT_ADMIN_PASSWORD,
  currentStudent: null,
  selectedAdminTab: "students",
  studentFilter: "pending",
  selectedConversationId: null,
  students: [],
  announcements: [],
  messages: [],
  readReceipts: [],
  passwordRequests: [],
  auditLogs: [],
  unsubscribers: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  updateNotice: $("#updateNotice"),
  reloadAppBtn: $("#reloadAppBtn"),
  systemNotice: $("#systemNotice"),
  authView: $("#authView"),
  studentView: $("#studentView"),
  adminView: $("#adminView"),
  profileBtn: $("#profileBtn"),
  logoutBtn: $("#logoutBtn"),
  loginTab: $("#loginTab"),
  registerTab: $("#registerTab"),
  adminTab: $("#adminTab"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  adminLoginForm: $("#adminLoginForm"),
  forgotPasswordBtn: $("#forgotPasswordBtn"),
  loginSchoolNo: $("#loginSchoolNo"),
  loginPin: $("#loginPin"),
  firstName: $("#firstName"),
  lastName: $("#lastName"),
  schoolNo: $("#schoolNo"),
  classYear: $("#classYear"),
  pin: $("#pin"),
  adminPass: $("#adminPass"),
  studentTitle: $("#studentTitle"),
  studentStatus: $("#studentStatus"),
  enableNotificationsBtn: $("#enableNotificationsBtn"),
  studentAnnouncements: $("#studentAnnouncements"),
  studentMessages: $("#studentMessages"),
  studentMessageForm: $("#studentMessageForm"),
  studentMessageBody: $("#studentMessageBody"),
  pendingBadge: $("#pendingBadge"),
  messageBadge: $("#messageBadge"),
  studentsList: $("#studentsList"),
  newAnnouncementBtn: $("#newAnnouncementBtn"),
  announcementsAdminList: $("#announcementsAdminList"),
  conversationList: $("#conversationList"),
  conversationTitle: $("#conversationTitle"),
  adminConversationMessages: $("#adminConversationMessages"),
  adminReplyForm: $("#adminReplyForm"),
  adminReplyBody: $("#adminReplyBody"),
  announcementStats: $("#announcementStats"),
  auditLogs: $("#auditLogs"),
  exportReportBtn: $("#exportReportBtn"),
  adminPasswordForm: $("#adminPasswordForm"),
  adminNewPassword: $("#adminNewPassword"),
  passwordRequestsList: $("#passwordRequestsList"),
  modalBackdrop: $("#modalBackdrop"),
  modalCloseBtn: $("#modalCloseBtn"),
  modalContent: $("#modalContent"),
  toast: $("#toast")
};

boot();

async function boot() {
  await initFirebase();
  await loadAdminPassword();
  bindEvents();
  registerServiceWorker();

  const studentNo = localStorage.getItem(STUDENT_SESSION_KEY);
  if (studentNo) {
    await openStudentSession(studentNo, true);
    return;
  }
  if (localStorage.getItem(ADMIN_SESSION_KEY) === "true") {
    openAdminPanel();
    return;
  }
  showAuth("login");
}

async function initFirebase() {
  try {
    const appApi = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const fs = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    state.app = appApi.initializeApp(firebaseConfig);
    state.db = fs.getFirestore(state.app);
    state.fs = fs;
  } catch (error) {
    console.error(error);
    showNotice("Firebase bağlantısı kurulamadı. Config ve internet bağlantısını kontrol et.");
  }
}

function bindEvents() {
  els.reloadAppBtn.addEventListener("click", () => location.reload());
  els.loginTab.addEventListener("click", () => showAuth("login"));
  els.registerTab.addEventListener("click", () => showAuth("register"));
  els.adminTab.addEventListener("click", () => showAuth("admin"));
  els.loginForm.addEventListener("submit", handleStudentLogin);
  els.registerForm.addEventListener("submit", handleRegister);
  els.adminLoginForm.addEventListener("submit", handleAdminLogin);
  els.forgotPasswordBtn.addEventListener("click", handleForgotPassword);
  els.logoutBtn.addEventListener("click", logout);
  els.profileBtn.addEventListener("click", openProfileModal);
  els.enableNotificationsBtn.addEventListener("click", enableNotifications);
  els.studentMessageForm.addEventListener("submit", handleStudentMessage);
  els.newAnnouncementBtn.addEventListener("click", () => openAnnouncementEditor());
  els.adminReplyForm.addEventListener("submit", handleAdminReply);
  els.exportReportBtn.addEventListener("click", exportWordReport);
  els.adminPasswordForm.addEventListener("submit", handleAdminPasswordChange);
  els.modalCloseBtn.addEventListener("click", closeModal);
  els.modalBackdrop.addEventListener("click", (event) => {
    if (event.target === els.modalBackdrop) closeModal();
  });

  $$(".admin-tab").forEach((button) => {
    button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab));
  });
  $$("[data-student-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.studentFilter = button.dataset.studentFilter;
      $$("[data-student-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderStudents();
    });
  });
}

function showAuth(tab) {
  cleanupListeners();
  state.currentStudent = null;
  els.authView.classList.remove("hidden");
  els.studentView.classList.add("hidden");
  els.adminView.classList.add("hidden");
  els.profileBtn.classList.add("hidden");
  els.logoutBtn.classList.add("hidden");
  els.loginForm.classList.toggle("hidden", tab !== "login");
  els.registerForm.classList.toggle("hidden", tab !== "register");
  els.adminLoginForm.classList.toggle("hidden", tab !== "admin");
  els.loginTab.classList.toggle("active", tab === "login");
  els.registerTab.classList.toggle("active", tab === "register");
  els.adminTab.classList.toggle("active", tab === "admin");
}

async function handleRegister(event) {
  event.preventDefault();
  const student = {
    firstName: clean(els.firstName.value),
    lastName: clean(els.lastName.value),
    schoolNo: digits(els.schoolNo.value),
    classYear: els.classYear.value,
    pin: digits(els.pin.value),
    status: "pending",
    mustChangePin: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (!student.firstName || !student.lastName || !student.schoolNo || !student.classYear) return toast("Tüm alanları doldur.");
  if (!isPin(student.pin)) return toast("Şifre 4 haneli rakam olmalı.");
  if (await getStudent(student.schoolNo)) return toast("Bu okul no ile kayıt zaten var.");
  await setDoc("students", student.schoolNo, student);
  await addAudit("Başvuru oluşturuldu", student.schoolNo, fullName(student));
  els.registerForm.reset();
  showAuth("login");
  toast("Başvuru alındı. Yönetici onayından sonra giriş yapabilirsin.");
}

async function handleStudentLogin(event) {
  event.preventDefault();
  const schoolNo = digits(els.loginSchoolNo.value);
  const pin = digits(els.loginPin.value);
  if (!schoolNo || !isPin(pin)) return toast("Okul no ve 4 haneli şifre gerekli.");
  const student = await getStudent(schoolNo);
  if (!student) return toast("Kayıt bulunamadı.");
  if (student.status !== "approved") return toast("Başvurun henüz onaylanmadı.");
  if (student.pin !== pin) return toast("Şifre hatalı.");
  localStorage.setItem(STUDENT_SESSION_KEY, schoolNo);
  await addAudit("Öğrenci girişi", schoolNo, fullName(student));
  await openStudentSession(schoolNo);
}

async function openStudentSession(schoolNo, silent = false) {
  const student = await getStudent(schoolNo);
  if (!student || student.status !== "approved") {
    localStorage.removeItem(STUDENT_SESSION_KEY);
    showAuth("login");
    if (!silent) toast("Oturum açılamadı.");
    return;
  }
  cleanupListeners();
  state.currentStudent = student;
  els.authView.classList.add("hidden");
  els.adminView.classList.add("hidden");
  els.studentView.classList.remove("hidden");
  els.profileBtn.classList.remove("hidden");
  els.logoutBtn.classList.remove("hidden");
  renderStudentHeader();
  watch("announcements", (items) => {
    state.announcements = items.sort(byDateDesc);
    renderStudentAnnouncements();
  });
  watch("readReceipts", (items) => {
    state.readReceipts = items;
    renderStudentAnnouncements();
  });
  watch("messages", (items) => {
    state.messages = items.sort(byDateAsc);
    renderStudentMessages();
  });
}

async function handleAdminLogin(event) {
  event.preventDefault();
  await loadAdminPassword();
  if (els.adminPass.value !== state.adminPassword) return toast("Yönetici şifresi hatalı.");
  localStorage.setItem(ADMIN_SESSION_KEY, "true");
  els.adminLoginForm.reset();
  await addAudit("Yönetici girişi", "admin", "Yönetici");
  openAdminPanel();
}

function openAdminPanel() {
  cleanupListeners();
  els.authView.classList.add("hidden");
  els.studentView.classList.add("hidden");
  els.adminView.classList.remove("hidden");
  els.profileBtn.classList.remove("hidden");
  els.logoutBtn.classList.remove("hidden");
  switchAdminTab(state.selectedAdminTab);
  watch("students", (items) => { state.students = items.sort(byStudent); renderAdminAll(); });
  watch("announcements", (items) => { state.announcements = items.sort(byDateDesc); renderAdminAll(); });
  watch("messages", (items) => { state.messages = items.sort(byDateAsc); renderAdminAll(); });
  watch("readReceipts", (items) => { state.readReceipts = items; renderAdminAll(); });
  watch("passwordRequests", (items) => { state.passwordRequests = items.sort(byDateDesc); renderAdminAll(); });
  watch("auditLogs", (items) => { state.auditLogs = items.sort(byDateDesc); renderAdminAll(); });
}

function renderAdminAll() {
  renderBadges();
  renderStudents();
  renderAdminAnnouncements();
  renderConversations();
  renderConversationMessages();
  renderPasswordRequests();
  renderReports();
}

function switchAdminTab(tab) {
  state.selectedAdminTab = tab;
  $$(".admin-tab").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === tab));
  const map = {
    students: $("#adminStudents"),
    announcements: $("#adminAnnouncements"),
    messages: $("#adminMessages"),
    reports: $("#adminReports"),
    settings: $("#adminSettings")
  };
  Object.entries(map).forEach(([key, section]) => section.classList.toggle("hidden", key !== tab));
}

function renderBadges() {
  const pending = state.students.filter((student) => student.status === "pending").length;
  const unread = state.messages.filter((message) => message.sender === "student" && !message.readByAdmin).length;
  setBadge(els.pendingBadge, pending);
  setBadge(els.messageBadge, unread);
}

function renderStudentHeader() {
  const student = state.currentStudent;
  els.studentTitle.textContent = fullName(student);
  els.studentStatus.textContent = `Okul No: ${student.schoolNo} | ${student.classYear || "Sınıf yok"}`;
}

function renderStudents() {
  const items = state.students.filter((student) => student.status === state.studentFilter);
  renderList(els.studentsList, items, "Bu bölümde öğrenci yok.", (student) => `
    <article class="item">
      <div class="item-header">
        <h3>${escapeHtml(fullName(student))}</h3>
        <small>${escapeHtml(student.status)}</small>
      </div>
      <p>Okul No: ${escapeHtml(student.schoolNo)} | ${escapeHtml(student.classYear || "Sınıf yok")}</p>
      <p>${student.mustChangePin ? "Şifre 1234 yapıldı, öğrencinin değiştirmesi bekleniyor." : "Şifre aktif."}</p>
      <div class="actions">
        ${student.status === "pending" ? `<button class="secondary" data-student-action="approve" data-school="${escapeHtml(student.schoolNo)}">Onayla</button>` : ""}
        ${student.status === "approved" ? `<button class="accent" data-student-action="reset" data-school="${escapeHtml(student.schoolNo)}">Şifreyi 1234 Yap</button><button class="danger" data-student-action="block" data-school="${escapeHtml(student.schoolNo)}">Pasife Al</button>` : ""}
        ${student.status === "blocked" ? `<button class="secondary" data-student-action="approve" data-school="${escapeHtml(student.schoolNo)}">Tekrar Onayla</button>` : ""}
        <button class="secondary" data-student-action="edit" data-school="${escapeHtml(student.schoolNo)}">Düzenle</button>
        <button class="danger" data-student-action="delete" data-school="${escapeHtml(student.schoolNo)}">Sil</button>
      </div>
    </article>
  `);
  $$("[data-student-action]").forEach((button) => {
    button.addEventListener("click", () => handleStudentAction(button.dataset.studentAction, button.dataset.school));
  });
}

async function handleStudentAction(action, schoolNo) {
  const student = await getStudent(schoolNo);
  if (!student) return toast("Öğrenci bulunamadı.");
  if (action === "edit") return openStudentEditor(student);
  if (action === "delete") {
    if (!confirm(`${fullName(student)} silinsin mi?`)) return;
    await deleteDoc("students", schoolNo);
  }
  if (action === "approve") await updateDoc("students", schoolNo, { status: "approved", updatedAt: Date.now() });
  if (action === "block") await updateDoc("students", schoolNo, { status: "blocked", updatedAt: Date.now() });
  if (action === "reset") await updateDoc("students", schoolNo, { pin: RESET_PIN, mustChangePin: true, updatedAt: Date.now() });
  await addAudit(`Öğrenci işlemi: ${action}`, schoolNo, fullName(student));
  toast("İşlem tamamlandı.");
}

function openStudentEditor(student) {
  openModal(`
    <h2>Öğrenci Düzenle</h2>
    <form id="studentEditForm" class="form">
      <label>İsim <input id="editFirstName" value="${escapeHtml(student.firstName)}" required /></label>
      <label>Soyisim <input id="editLastName" value="${escapeHtml(student.lastName)}" required /></label>
      <label>Sınıf <select id="editClassYear" required><option ${student.classYear === "1. sınıf" ? "selected" : ""}>1. sınıf</option><option ${student.classYear === "2. sınıf" ? "selected" : ""}>2. sınıf</option></select></label>
      <button class="primary" type="submit">Kaydet</button>
    </form>
  `);
  $("#studentEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await updateDoc("students", student.schoolNo, {
      firstName: clean($("#editFirstName").value),
      lastName: clean($("#editLastName").value),
      classYear: $("#editClassYear").value,
      updatedAt: Date.now()
    });
    await addAudit("Öğrenci düzenlendi", student.schoolNo, fullName(student));
    closeModal();
    toast("Öğrenci güncellendi.");
  });
}

function renderStudentAnnouncements() {
  const student = state.currentStudent;
  const items = state.announcements.filter((item) => !item.targetClass || item.targetClass === "all" || item.targetClass === student.classYear);
  renderList(els.studentAnnouncements, items, "Henüz duyuru yok.", (item) => {
    const read = receiptFor(item.id, student.schoolNo);
    return `
      <article class="item clickable" data-open-announcement="${escapeHtml(item.id)}">
        <div class="item-header"><h3>${escapeHtml(item.title)}</h3><small>${formatDate(item.createdAt)}</small></div>
        <p>${escapeHtml(item.body).slice(0, 160)}${item.body.length > 160 ? "..." : ""}</p>
        <p class="muted">${read ? `Okundu: ${formatDate(read.createdAt)}` : "Okunmadı"}</p>
      </article>
    `;
  });
  $$("[data-open-announcement]").forEach((item) => item.addEventListener("click", () => openAnnouncementReader(item.dataset.openAnnouncement)));
}

function renderAdminAnnouncements() {
  renderList(els.announcementsAdminList, state.announcements, "Henüz duyuru yok.", (item) => {
    const readCount = state.readReceipts.filter((receipt) => receipt.announcementId === item.id).length;
    const eligible = eligibleStudentsFor(item).length;
    return `
      <article class="item">
        <div class="item-header"><h3>${escapeHtml(item.title)}</h3><small>${formatDate(item.createdAt)}</small></div>
        <p>${escapeHtml(item.body)}</p>
        <p class="muted">Hedef: ${labelTarget(item.targetClass)} | Okundu: ${readCount}/${eligible} | Push: ${item.pushSent ? "Gönderildi" : "Bekliyor"}</p>
        <div class="actions">
          <button class="secondary" data-announcement-action="edit" data-id="${escapeHtml(item.id)}">Düzenle</button>
          <button class="danger" data-announcement-action="delete" data-id="${escapeHtml(item.id)}">Sil</button>
        </div>
      </article>
    `;
  });
  $$("[data-announcement-action]").forEach((button) => {
    button.addEventListener("click", () => handleAnnouncementAction(button.dataset.announcementAction, button.dataset.id));
  });
}

function openAnnouncementEditor(item = null) {
  openModal(`
    <h2>${item ? "Duyuru Düzenle" : "Yeni Duyuru"}</h2>
    <form id="announcementEditorForm" class="form">
      <label>Başlık <input id="editAnnouncementTitle" value="${escapeHtml(item?.title || "")}" required /></label>
      <label>Duyuru <textarea id="editAnnouncementBody" rows="6" required>${escapeHtml(item?.body || "")}</textarea></label>
      <label>Hedef Sınıf
        <select id="editAnnouncementTarget">
          <option value="all" ${!item?.targetClass || item?.targetClass === "all" ? "selected" : ""}>Tüm öğrenciler</option>
          <option value="1. sınıf" ${item?.targetClass === "1. sınıf" ? "selected" : ""}>1. sınıf</option>
          <option value="2. sınıf" ${item?.targetClass === "2. sınıf" ? "selected" : ""}>2. sınıf</option>
        </select>
      </label>
      <button class="primary" type="submit">${item ? "Güncelle" : "Yayınla"}</button>
    </form>
  `);
  $("#announcementEditorForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      title: clean($("#editAnnouncementTitle").value),
      body: clean($("#editAnnouncementBody").value),
      targetClass: $("#editAnnouncementTarget").value,
      updatedAt: Date.now(),
      pushSent: false,
      pushSentAt: null
    };
    if (item) {
      await updateDoc("announcements", item.id, payload);
      await addAudit("Duyuru düzenlendi", "admin", "Yönetici", payload.title);
    } else {
      await addDoc("announcements", { ...payload, createdAt: Date.now() });
      await addAudit("Duyuru yayınlandı", "admin", "Yönetici", payload.title);
    }
    closeModal();
    toast(item ? "Duyuru güncellendi." : "Duyuru yayınlandı.");
  });
}

async function handleAnnouncementAction(action, id) {
  const item = state.announcements.find((announcement) => announcement.id === id);
  if (!item) return;
  if (action === "edit") return openAnnouncementEditor(item);
  if (action === "delete") {
    if (!confirm("Duyuru silinsin mi?")) return;
    await deleteDoc("announcements", id);
    await addAudit("Duyuru silindi", "admin", "Yönetici", item.title);
    toast("Duyuru silindi.");
  }
}

function openAnnouncementReader(id) {
  const item = state.announcements.find((announcement) => announcement.id === id);
  if (!item) return;
  const read = receiptFor(item.id, state.currentStudent.schoolNo);
  openModal(`
    <h2>${escapeHtml(item.title)}</h2>
    <p class="muted">${formatDate(item.createdAt)}</p>
    <p>${escapeHtml(item.body)}</p>
    ${read ? `<p class="muted">Okundu: ${formatDate(read.createdAt)}</p>` : `<button id="markReadBtn" class="primary" type="button">Okudum</button>`}
  `);
  const button = $("#markReadBtn");
  if (button) button.addEventListener("click", () => markRead(item));
}

async function markRead(item) {
  const student = state.currentStudent;
  const id = `${item.id}_${student.schoolNo}`;
  await setDoc("readReceipts", id, {
    announcementId: item.id,
    announcementTitle: item.title,
    schoolNo: student.schoolNo,
    studentName: fullName(student),
    classYear: student.classYear,
    createdAt: Date.now()
  });
  await addAudit("Duyuru okundu", student.schoolNo, fullName(student), item.title);
  closeModal();
  toast("Okundu olarak işaretlendi.");
}

async function handleStudentMessage(event) {
  event.preventDefault();
  const body = clean(els.studentMessageBody.value);
  if (!body) return;
  const student = state.currentStudent;
  await addDoc("messages", {
    conversationId: student.schoolNo,
    schoolNo: student.schoolNo,
    studentName: fullName(student),
    sender: "student",
    body,
    readByAdmin: false,
    readByStudent: true,
    createdAt: Date.now()
  });
  await addAudit("Mesaj gönderildi", student.schoolNo, fullName(student), body);
  els.studentMessageBody.value = "";
  toast("Mesaj gönderildi.");
}

function renderStudentMessages() {
  const student = state.currentStudent;
  const items = state.messages.filter((message) => message.conversationId === student.schoolNo);
  renderChat(els.studentMessages, items);
}

function renderConversations() {
  const conversations = groupConversations();
  renderList(els.conversationList, conversations, "Konuşma yok.", (conversation) => `
    <article class="item clickable" data-conversation="${escapeHtml(conversation.id)}">
      <div class="item-header">
        <h3>${escapeHtml(conversation.studentName)}</h3>
        ${conversation.unread ? `<span class="badge">${conversation.unread}</span>` : ""}
      </div>
      <p>Okul No: ${escapeHtml(conversation.id)}</p>
      <p class="muted">${escapeHtml(conversation.lastMessage || "")}</p>
    </article>
  `);
  $$("[data-conversation]").forEach((item) => {
    item.addEventListener("click", () => openConversation(item.dataset.conversation));
  });
}

async function openConversation(id) {
  state.selectedConversationId = id;
  const unread = state.messages.filter((message) => message.conversationId === id && message.sender === "student" && !message.readByAdmin);
  await Promise.all(unread.map((message) => updateDoc("messages", message.id, { readByAdmin: true })));
  renderConversationMessages();
  switchAdminTab("messages");
}

function renderConversationMessages() {
  const id = state.selectedConversationId;
  if (!id) {
    els.conversationTitle.textContent = "Konuşma seç";
    els.adminConversationMessages.innerHTML = `<p class="empty">Soldan bir konuşma seç.</p>`;
    els.adminReplyForm.classList.add("hidden");
    return;
  }
  const items = state.messages.filter((message) => message.conversationId === id);
  const student = state.students.find((item) => item.schoolNo === id);
  els.conversationTitle.textContent = student ? fullName(student) : (items[0]?.studentName || id);
  renderChat(els.adminConversationMessages, items);
  els.adminReplyForm.classList.remove("hidden");
}

async function handleAdminReply(event) {
  event.preventDefault();
  const id = state.selectedConversationId;
  const body = clean(els.adminReplyBody.value);
  if (!id || !body) return;
  const student = state.students.find((item) => item.schoolNo === id);
  await addDoc("messages", {
    conversationId: id,
    schoolNo: id,
    studentName: student ? fullName(student) : id,
    sender: "admin",
    body,
    readByAdmin: true,
    readByStudent: false,
    createdAt: Date.now()
  });
  await addAudit("Mesaja cevap verildi", id, "Yönetici", body);
  els.adminReplyBody.value = "";
  toast("Cevap gönderildi.");
}

function renderChat(container, items) {
  container.innerHTML = items.length ? items.map((message) => `
    <div class="bubble ${message.sender === "admin" ? "admin" : "student"}">
      <strong>${message.sender === "admin" ? "Yönetici" : escapeHtml(message.studentName)}</strong>
      <p>${escapeHtml(message.body)}</p>
      <small>${formatDate(message.createdAt)}</small>
    </div>
  `).join("") : `<p class="empty">Mesaj yok.</p>`;
  container.scrollTop = container.scrollHeight;
}

function renderPasswordRequests() {
  renderList(els.passwordRequestsList, state.passwordRequests, "Talep yok.", (request) => `
    <article class="item">
      <div class="item-header"><h3>${escapeHtml(request.studentName)}</h3><small>${formatDate(request.createdAt)}</small></div>
      <p>Okul No: ${escapeHtml(request.schoolNo)} | Durum: ${escapeHtml(request.status)}</p>
      ${request.status === "open" ? `<div class="actions"><button class="accent" data-reset-request="${escapeHtml(request.id)}">Şifreyi 1234 Yap</button></div>` : ""}
    </article>
  `);
  $$("[data-reset-request]").forEach((button) => button.addEventListener("click", () => resolvePasswordRequest(button.dataset.resetRequest)));
}

async function handleForgotPassword() {
  const schoolNo = digits(els.loginSchoolNo.value);
  if (!schoolNo) return toast("Önce okul numaranı yaz.");
  const student = await getStudent(schoolNo);
  if (!student) return toast("Bu okul no ile kayıt bulunamadı.");
  await addDoc("passwordRequests", {
    schoolNo,
    studentName: fullName(student),
    status: "open",
    createdAt: Date.now()
  });
  await addAudit("Şifre sıfırlama talebi", schoolNo, fullName(student));
  toast("Talep yönetici paneline düştü.");
}

async function resolvePasswordRequest(id) {
  const request = state.passwordRequests.find((item) => item.id === id);
  if (!request) return;
  await updateDoc("students", request.schoolNo, { pin: RESET_PIN, mustChangePin: true, updatedAt: Date.now() });
  await updateDoc("passwordRequests", id, { status: "done", resolvedAt: Date.now() });
  await addAudit("Şifre talebi sıfırlandı", request.schoolNo, "Yönetici");
  toast("Şifre 1234 olarak sıfırlandı.");
}

function renderReports() {
  const approved = state.students.filter((student) => student.status === "approved");
  renderList(els.announcementStats, state.announcements, "Duyuru yok.", (item) => {
    const eligible = eligibleStudentsFor(item);
    const receipts = state.readReceipts.filter((receipt) => receipt.announcementId === item.id);
    return `
      <article class="item">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${receipts.length} / ${eligible.length || approved.length} öğrenci okudu.</p>
        <p class="muted">${receipts.map((receipt) => escapeHtml(receipt.studentName)).join(", ") || "Henüz okuyan yok."}</p>
      </article>
    `;
  });
  renderList(els.auditLogs, state.auditLogs.slice(0, 80), "İşlem kaydı yok.", (log) => `
    <article class="item">
      <div class="item-header"><h3>${escapeHtml(log.action)}</h3><small>${formatDate(log.createdAt)}</small></div>
      <p>${escapeHtml(log.actorName || "")} ${log.actorId ? `(${escapeHtml(log.actorId)})` : ""}</p>
      ${log.detail ? `<p>${escapeHtml(log.detail)}</p>` : ""}
    </article>
  `);
}

async function handleAdminPasswordChange(event) {
  event.preventDefault();
  const password = clean(els.adminNewPassword.value);
  if (password.length < 4) return toast("Şifre en az 4 karakter olmalı.");
  await setDoc("settings", "admin", { password, updatedAt: Date.now() });
  state.adminPassword = password;
  els.adminNewPassword.value = "";
  await addAudit("Yönetici şifresi değiştirildi", "admin", "Yönetici");
  toast("Yönetici şifresi güncellendi.");
}

function openProfileModal() {
  if (!state.currentStudent) {
    switchAdminTab("settings");
    return;
  }
  const student = state.currentStudent;
  openModal(`
    <h2>Profilim</h2>
    <form id="profileForm" class="form">
      <label>İsim <input id="profileFirstName" value="${escapeHtml(student.firstName)}" required /></label>
      <label>Soyisim <input id="profileLastName" value="${escapeHtml(student.lastName)}" required /></label>
      <label>Sınıf <select id="profileClassYear" required><option ${student.classYear === "1. sınıf" ? "selected" : ""}>1. sınıf</option><option ${student.classYear === "2. sınıf" ? "selected" : ""}>2. sınıf</option></select></label>
      <label>Yeni 4 Haneli Şifre <input id="profilePin" inputmode="numeric" maxlength="4" placeholder="Değişmeyecekse boş bırak" /></label>
      <button class="primary" type="submit">Kaydet</button>
    </form>
  `);
  $("#profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = digits($("#profilePin").value);
    const patch = {
      firstName: clean($("#profileFirstName").value),
      lastName: clean($("#profileLastName").value),
      classYear: $("#profileClassYear").value,
      mustChangePin: false,
      updatedAt: Date.now()
    };
    if (pin && !isPin(pin)) return toast("Şifre 4 haneli olmalı.");
    if (pin) patch.pin = pin;
    await updateDoc("students", student.schoolNo, patch);
    state.currentStudent = await getStudent(student.schoolNo);
    renderStudentHeader();
    await addAudit("Profil güncellendi", student.schoolNo, fullName(state.currentStudent));
    closeModal();
    toast("Profil güncellendi.");
  });
}

async function enableNotifications() {
  try {
    if (!state.currentStudent) return toast("Once ogrenci girisi yap.");
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return toast("Bu tarayici web push bildirimini desteklemiyor.");
    }
    if (!webPushPublicKey) return toast("Web Push anahtari eksik.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return toast("Bildirim izni verilmedi.");
    const registration = await navigator.serviceWorker.register("./sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(webPushPublicKey)
    });
    const student = state.currentStudent;
    await setDoc("pushSubscriptions", stableSubscriptionId(subscription), {
      subscription: subscription.toJSON(),
      schoolNo: student.schoolNo,
      studentName: fullName(student),
      classYear: student.classYear || "",
      userAgent: navigator.userAgent,
      updatedAt: Date.now()
    });
    await addAudit("Bildirimler acildi", student.schoolNo, fullName(student));
    toast("Bildirimler acildi.");
  } catch (error) {
    console.error(error);
    toast(`Bildirim acilamadi: ${error.message || "Hata"}`);
  }
}
async function loadAdminPassword() {
  const settings = await getDocData("settings", "admin");
  state.adminPassword = settings?.password || DEFAULT_ADMIN_PASSWORD;
}

async function getStudent(schoolNo) {
  return getDocData("students", schoolNo);
}

async function addAudit(action, actorId, actorName, detail = "") {
  await addDoc("auditLogs", { action, actorId, actorName, detail, createdAt: Date.now() });
}

function groupConversations() {
  const map = new Map();
  state.messages.forEach((message) => {
    const current = map.get(message.conversationId) || {
      id: message.conversationId,
      studentName: message.studentName,
      lastMessage: "",
      updatedAt: 0,
      unread: 0
    };
    if (message.createdAt >= current.updatedAt) {
      current.lastMessage = message.body;
      current.updatedAt = message.createdAt;
      current.studentName = message.studentName;
    }
    if (message.sender === "student" && !message.readByAdmin) current.unread += 1;
    map.set(message.conversationId, current);
  });
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

function eligibleStudentsFor(announcement) {
  return state.students.filter((student) => {
    if (student.status !== "approved") return false;
    return !announcement.targetClass || announcement.targetClass === "all" || announcement.targetClass === student.classYear;
  });
}

function receiptFor(announcementId, schoolNo) {
  return state.readReceipts.find((receipt) => receipt.announcementId === announcementId && receipt.schoolNo === schoolNo);
}

async function getDocData(collectionName, id) {
  const { doc, getDoc } = state.fs;
  const snap = await getDoc(doc(state.db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function setDoc(collectionName, id, value) {
  const { doc, setDoc } = state.fs;
  await setDoc(doc(state.db, collectionName, id), value);
}

async function updateDoc(collectionName, id, value) {
  const { doc, updateDoc } = state.fs;
  await updateDoc(doc(state.db, collectionName, id), value);
}

async function deleteDoc(collectionName, id) {
  const { doc, deleteDoc } = state.fs;
  await deleteDoc(doc(state.db, collectionName, id));
}

async function addDoc(collectionName, value) {
  const { collection, addDoc } = state.fs;
  await addDoc(collection(state.db, collectionName), value);
}

function watch(collectionName, callback) {
  const { collection, onSnapshot } = state.fs;
  const unsubscribe = onSnapshot(collection(state.db, collectionName), (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error(error);
    showNotice(`${collectionName} okunamadı. Firestore Rules kontrol edilmeli.`);
  });
  state.unsubscribers.push(unsubscribe);
}

function cleanupListeners() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

function logout() {
  localStorage.removeItem(STUDENT_SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
  state.currentStudent = null;
  state.selectedConversationId = null;
  closeModal();
  showAuth("login");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    if (registration.waiting) showUpdateNotice();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdateNotice();
      });
    });
  }).catch(console.error);
}

function showUpdateNotice() {
  els.updateNotice.classList.remove("hidden");
}

function openModal(html) {
  els.modalContent.innerHTML = html;
  els.modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  els.modalBackdrop.classList.add("hidden");
  els.modalContent.innerHTML = "";
}

function exportWordReport() {
  const rows = [
    "<h1>AMH Öğrenci Portalı Raporu</h1>",
    `<p>Oluşturma zamanı: ${formatDate(Date.now())}</p>`,
    "<h2>Duyuru Okunma İstatistikleri</h2>",
    ...state.announcements.map((announcement) => {
      const receipts = state.readReceipts.filter((receipt) => receipt.announcementId === announcement.id);
      return `<h3>${escapeHtml(announcement.title)}</h3><p>${receipts.length} / ${eligibleStudentsFor(announcement).length} öğrenci okudu.</p><ul>${receipts.map((r) => `<li>${escapeHtml(r.studentName)} - ${formatDate(r.createdAt)}</li>`).join("")}</ul>`;
    }),
    "<h2>Mesajlar</h2>",
    ...state.messages.map((m) => `<p><strong>${escapeHtml(m.studentName)} (${escapeHtml(m.schoolNo)})</strong> - ${escapeHtml(m.sender)} - ${formatDate(m.createdAt)}<br>${escapeHtml(m.body)}</p>`),
    "<h2>İşlem Kayıtları</h2>",
    ...state.auditLogs.map((log) => `<p>${formatDate(log.createdAt)} - ${escapeHtml(log.action)} - ${escapeHtml(log.actorName || "")} ${log.detail ? "- " + escapeHtml(log.detail) : ""}</p>`)
  ];
  const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"></head><body>${rows.join("")}</body></html>`], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `amh-rapor-${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  addAudit("Word raporu indirildi", "admin", "Yönetici");
}

function renderList(container, items, emptyText, template) {
  container.innerHTML = items.length ? items.map(template).join("") : `<p class="empty">${emptyText}</p>`;
}

function setBadge(element, count) {
  element.textContent = count;
  element.classList.toggle("hidden", count === 0);
}

function showNotice(message) {
  els.systemNotice.textContent = message;
  els.systemNotice.classList.remove("hidden");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.setTimeout(() => els.toast.classList.add("hidden"), 2600);
}

function clean(value) { return String(value || "").trim().replace(/\s+/g, " "); }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function isPin(value) { return /^\d{4}$/.test(value); }
function fullName(student) { return `${student.firstName || ""} ${student.lastName || ""}`.trim(); }
function byDateDesc(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }
function byDateAsc(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }
function byStudent(a, b) { return fullName(a).localeCompare(fullName(b), "tr"); }
function labelTarget(value) { return !value || value === "all" ? "Tüm öğrenciler" : value; }
function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value || Date.now()));
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stableSubscriptionId(subscription) {
  return btoa(subscription.endpoint).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

window.__AMH_PORTAL_VERSION__ = APP_VERSION;
