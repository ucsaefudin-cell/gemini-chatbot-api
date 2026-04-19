// script.js

// ── DOM references ──────────────────────────────────────────────────────────
const chatbotWidget   = document.getElementById('chatbot-widget');
const chatbotHeader   = document.getElementById('chatbot-header');
const closeChatbot    = document.getElementById('close-chatbot');
const chatbotBody     = document.getElementById('chatbot-body');
const sessionsList    = document.getElementById('sessions-list');
const newSessionBtn   = document.getElementById('new-session');
const clearHistoryBtn = document.getElementById('clear-history');
const chatForm        = document.getElementById('chat-form');
const userInput       = document.getElementById('user-input');
const chatBox         = document.getElementById('chat-box');

// FAB elements (defined in index.html, referenced here so script.js owns all open/close logic)
const fab           = document.getElementById('chatbot-fab');
const fabIconOpen   = document.getElementById('fab-icon-open');
const fabIconClose  = document.getElementById('fab-icon-close');

// ── State ───────────────────────────────────────────────────────────────────
let currentConversation = [];
let currentSessionId    = null;

// ── Open / Close ────────────────────────────────────────────────────────────
function openChat() {
    chatbotWidget.style.display = 'block';
    if (fabIconOpen)  fabIconOpen.classList.add('hidden');
    if (fabIconClose) fabIconClose.classList.remove('hidden');
    if (fab) fab.setAttribute('aria-label', 'Tutup chatbot');
}

function closeChat() {
    // Fully hide the entire widget — no minimize state
    chatbotWidget.style.display = 'none';
    if (fabIconOpen)  fabIconOpen.classList.remove('hidden');
    if (fabIconClose) fabIconClose.classList.add('hidden');
    if (fab) fab.setAttribute('aria-label', 'Buka chatbot');
}

// ── localStorage helpers ────────────────────────────────────────────────────
function loadSessions() {
    return JSON.parse(localStorage.getItem('chatSessions')) || [];
}

function saveSessions(sessions) {
    localStorage.setItem('chatSessions', JSON.stringify(sessions));
}

// ── Session UI ──────────────────────────────────────────────────────────────
function renderSessions() {
    const sessions = loadSessions();
    sessionsList.innerHTML = '';
    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'session-item';
        div.textContent = session.name;
        div.onclick = () => loadSession(session.id);
        sessionsList.appendChild(div);
    });
}

function createNewSession() {
    const sessions   = loadSessions();
    const sessionId  = Date.now().toString();
    const sessionName = `Chat ${sessions.length + 1}`;
    sessions.push({ id: sessionId, name: sessionName, conversation: [] });
    saveSessions(sessions);
    loadSession(sessionId);
    renderSessions();
}

function loadSession(sessionId) {
    const session = loadSessions().find(s => s.id === sessionId);
    if (session) {
        currentSessionId    = sessionId;
        currentConversation = session.conversation;
        renderChat();
    }
}

function saveCurrentConversation() {
    if (!currentSessionId) return;
    const sessions = loadSessions();
    const session  = sessions.find(s => s.id === currentSessionId);
    if (session) {
        session.conversation = currentConversation;
        saveSessions(sessions);
    }
}

// ── Clear all history ───────────────────────────────────────────────────────
function clearAllHistory() {
    if (!confirm('Hapus semua riwayat chat? Tindakan ini tidak dapat dibatalkan.')) return;
    localStorage.removeItem('chatSessions');
    currentConversation    = [];
    currentSessionId       = null;
    chatBox.innerHTML      = '';
    sessionsList.innerHTML = '';
    createNewSession(); // start fresh with one empty session
}

// ── Chat rendering ──────────────────────────────────────────────────────────
function renderChat() {
    chatBox.innerHTML = '';
    currentConversation.forEach(msg => addMessage(msg.role, msg.text));
}

function addMessage(role, text, isTemporary = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    if (role === 'model') {
        div.innerHTML = marked.parse(text);
    } else {
        div.textContent = text;
    }
    if (isTemporary) div.id = 'temp-message';
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function replaceTempMessage(text) {
    const tmp = document.getElementById('temp-message');
    if (tmp) {
        tmp.innerHTML = marked.parse(text);
        tmp.removeAttribute('id');
    }
}

// ── Form submission ─────────────────────────────────────────────────────────
async function handleSubmit(event) {
    event.preventDefault();

    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    currentConversation.push({ role: 'user', text: userMessage });
    addMessage('user', userMessage);
    userInput.value = '';
    addMessage('model', 'Thinking...', true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation: currentConversation }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.result) {
            currentConversation.push({ role: 'model', text: data.result });
            replaceTempMessage(data.result);
        } else {
            replaceTempMessage('Sorry, no response received.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to get response from server. Please try again.');
        const tmp = document.getElementById('temp-message');
        if (tmp) tmp.remove();
    }

    saveCurrentConversation();
}

// ── Event listeners ─────────────────────────────────────────────────────────

// FAB: toggle open/close
if (fab) {
    fab.addEventListener('click', () => {
        chatbotWidget.style.display === 'none' ? openChat() : closeChat();
    });
}

// × button: fully close the entire widget (no minimize)
closeChatbot.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChat();
});

// New Chat
newSessionBtn.addEventListener('click', createNewSession);

// Clear History
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearAllHistory);
}

// Chat form
chatForm.addEventListener('submit', handleSubmit);

// ── Helper callable from HTML ────────────────────────────────────────────────
window.openChatbotWithMessage = function (msg) {
    openChat();
    const input = document.getElementById('user-input');
    if (input) { input.value = msg; input.focus(); }
};

// ── Init ─────────────────────────────────────────────────────────────────────
renderSessions();
if (loadSessions().length === 0) {
    createNewSession();
} else {
    const sessions = loadSessions();
    loadSession(sessions[sessions.length - 1].id);
}
