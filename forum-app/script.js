/* script.js */
// App State
const appState = {
    currentUser: null,
    currentRoom: null,
    forums: [],
    messages: {},
    messageCount: 0,
    discussionsJoined: new Set(),
    eventSource: null,
    typingUsers: {}
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadUserSession();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }
});

// Event Listeners
function initializeEventListeners() {
    // Join Form
    document.getElementById('joinForm').addEventListener('submit', handleJoin);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => navigateToScreen(btn.dataset.screen));
    });
    
    // Discussion Creation
    document.getElementById('startDiscussionBtn').addEventListener('click', openCreateModal);
    document.getElementById('createDiscussionForm').addEventListener('submit', handleCreateDiscussion);
    
    // Chat
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    document.getElementById('exitRoomBtn').addEventListener('click', exitRoom);
    document.getElementById('messageInput').addEventListener('input', handleTyping);
    
    // Topic Filters
    document.querySelectorAll('.topic-filter').forEach(filter => {
        filter.addEventListener('click', () => filterByTopic(filter.dataset.topic));
    });
    
    // Profile
    document.getElementById('signOutBtn').addEventListener('click', signOut);
}

// Real-time Connection
function connectToSSE() {
    if (appState.eventSource) appState.eventSource.close();
    
    appState.eventSource = new EventSource(`/api/sse?userId=${appState.currentUser.id}`);
    
    appState.eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
    };
    
    appState.eventSource.onerror = () => {
        setTimeout(connectToSSE, 5000);
    };
}

function handleServerEvent(data) {
    switch(data.type) {
        case 'message':
            if (data.roomId === appState.currentRoom?.id) {
                displayMessage(data.message);
            }
            break;
        case 'user_joined':
            if (data.roomId === appState.currentRoom?.id) {
                addSystemMessage(`${data.userName} joined the discussion`);
                updateParticipantCount(data.participants);
            }
            break;
        case 'user_left':
            if (data.roomId === appState.currentRoom?.id) {
                addSystemMessage(`${data.userName} left the discussion`);
                updateParticipantCount(data.participants);
            }
            break;
        case 'typing':
            handleTypingIndicator(data);
            break;
        case 'forum_created':
            appState.forums.unshift(data.forum);
            displayForums();
            break;
    }
}

// User Authentication
async function handleJoin(e) {
    e.preventDefault();
    const displayName = document.getElementById('displayName').value.trim();
    const aboutMe = document.getElementById('aboutMe').value.trim();
    
    if (!displayName) return;
    
    const interests = [];
    document.querySelectorAll('.interest-tag input:checked').forEach(input => {
        interests.push(input.value);
    });
    
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName, aboutMe, interests })
        });
        
        const user = await response.json();
        appState.currentUser = user;
        localStorage.setItem('forumUser', JSON.stringify(user));
        
        showMainScreen();
        connectToSSE();
        loadForums();
    } catch (error) {
        console.error('Join failed:', error);
    }
}

async function loadUserSession() {
    const savedUser = localStorage.getItem('forumUser');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        
        try {
            const response = await fetch(`/api/auth?userId=${user.id}`);
            if (response.ok) {
                appState.currentUser = await response.json();
                showMainScreen();
                connectToSSE();
                loadForums();
            } else {
                localStorage.removeItem('forumUser');
            }
        } catch (error) {
            localStorage.removeItem('forumUser');
        }
    }
}

async function signOut() {
    if (appState.currentUser) {
        await fetch('/api/auth', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: appState.currentUser.id })
        });
    }
    
    localStorage.removeItem('forumUser');
    if (appState.eventSource) appState.eventSource.close();
    location.reload();
}

// Screen Navigation
function showMainScreen() {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('discussionsScreen').classList.remove('hidden');
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('bottomNav').classList.remove('hidden');
    updateProfile();
}

function navigateToScreen(screen) {
    const screens = ['discussionsScreen', 'discoverScreen', 'activityScreen', 'profileScreen'];
    screens.forEach(s => document.getElementById(s).classList.add('hidden'));
    
    document.getElementById(screen + 'Screen').classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.screen === screen);
    });
    
    if (screen === 'activity') {
        document.getElementById('discussionsJoined').textContent = appState.discussionsJoined.size;
        document.getElementById('messagesCount').textContent = appState.messageCount;
    }
    
    if (screen === 'discover') {
        loadFeaturedForums();
    }
}

// Forum Management
async function loadForums() {
    try {
        const response = await fetch('/api/forums');
        const forums = await response.json();
        appState.forums = forums;
        displayForums();
    } catch (error) {
        console.error('Failed to load forums:', error);
    }
}

function displayForums(filter = 'all') {
    const forumsList = document.getElementById('forumsList');
    forumsList.innerHTML = '';
    
    const filteredForums = filter === 'all' 
        ? appState.forums 
        : appState.forums.filter(f => f.topic === filter);
    
    filteredForums.forEach(forum => {
        const forumCard = document.createElement('div');
        forumCard.className = 'forum-card glass-morphism p-4 rounded-xl cursor-pointer';
        forumCard.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-semibold text-lg flex-1">${forum.title}</h3>
                ${forum.participants > 0 ? '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded-full">LIVE</span>' : ''}
            </div>
            <div class="flex items-center justify-between text-sm text-gray-400">
                <span><i class="fas fa-user mr-1"></i>${forum.host}</span>
                <span><i class="fas fa-users mr-1"></i>${forum.participants}</span>
            </div>
            <div class="mt-2">
                <span class="text-xs bg-gray-800 px-2 py-1 rounded-full">${forum.topic}</span>
            </div>
        `;
        
        forumCard.addEventListener('click', () => joinForum(forum));
        forumsList.appendChild(forumCard);
    });
}

function filterByTopic(topic) {
    document.querySelectorAll('.topic-filter').forEach(btn => {
        if (btn.dataset.topic === topic) {
            btn.classList.add('bg-purple-600', 'text-white');
            btn.classList.remove('bg-gray-800');
        } else {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('bg-gray-800');
        }
    });
    
    displayForums(topic);
}

async function joinForum(forum) {
    try {
        const response = await fetch(`/api/forums/${forum.id}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: appState.currentUser.id })
        });
        
        if (response.ok) {
            const updatedForum = await response.json();
            appState.currentRoom = updatedForum;
            appState.discussionsJoined.add(forum.id);
            
            document.getElementById('roomTitle').textContent = updatedForum.title;
            document.getElementById('roomTopic').textContent = updatedForum.topic;
            document.getElementById('participantCount').textContent = updatedForum.participants;
            
            document.getElementById('discussionsScreen').classList.add('hidden');
            document.getElementById('discussionRoom').classList.remove('hidden');
            document.getElementById('bottomNav').classList.add('hidden');
            
            loadMessages(updatedForum.id);
        }
    } catch (error) {
        console.error('Failed to join forum:', error);
    }
}

async function exitRoom() {
    if (appState.currentRoom) {
        await fetch(`/api/forums/${appState.currentRoom.id}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: appState.currentUser.id })
        });
    }
    
    document.getElementById('discussionRoom').classList.add('hidden');
    document.getElementById('discussionsScreen').classList.remove('hidden');
    document.getElementById('bottomNav').classList.remove('hidden');
    document.getElementById('messagesContainer').innerHTML = '';
    
    appState.currentRoom = null;
    loadForums();
}

// Message Handling
async function loadMessages(forumId) {
    try {
        const response = await fetch(`/api/messages?forumId=${forumId}`);
        const messages = await response.json();
        
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        
        messages.forEach(msg => displayMessage(msg));
        
        if (messages.length === 0) {
            addSystemMessage(`Welcome to "${appState.currentRoom.title}"! Start the conversation.`);
        }
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !appState.currentRoom) return;
    
    input.value = '';
    input.disabled = true;
    
    try {
        await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                forumId: appState.currentRoom.id,
                userId: appState.currentUser.id,
                text
            })
        });
        
        appState.messageCount++;
    } catch (error) {
        console.error('Failed to send message:', error);
        input.value = text;
    } finally {
        input.disabled = false;
        input.focus();
    }
}

function displayMessage(message) {
    const container = document.getElementById('messagesContainer');
    const isOwn = message.userId === appState.currentUser.id;
    
    const messageEl = document.createElement('div');
    messageEl.className = `message-bubble ${isOwn ? 'ml-auto' : 'mr-auto'} max-w-xs`;
    
    messageEl.innerHTML = `
        <div class="${isOwn ? 'own-message' : 'other-message'} px-4 py-2 rounded-2xl">
            ${!isOwn ? `<p class="text-xs opacity-70 mb-1">${message.userName}</p>` : ''}
            <p class="text-sm">${message.text}</p>
            <p class="text-xs opacity-50 mt-1">${formatTime(message.timestamp)}</p>
        </div>
    `;
    
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

function addSystemMessage(text) {
    const container = document.getElementById('messagesContainer');
    const messageEl = document.createElement('div');
    messageEl.className = 'text-center text-xs text-gray-500 my-2';
    messageEl.textContent = text;
    container.appendChild(messageEl);
}

// Typing Indicator
let typingTimer;
function handleTyping() {
    if (!appState.currentRoom) return;
    
    clearTimeout(typingTimer);
    
    fetch('/api/messages/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            forumId: appState.currentRoom.id,
            userId: appState.currentUser.id
        })
    });
    
    typingTimer = setTimeout(() => {
        fetch('/api/messages/typing', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                forumId: appState.currentRoom.id,
                userId: appState.currentUser.id
            })
        });
    }, 2000);
}

function handleTypingIndicator(data) {
    if (data.roomId !== appState.currentRoom?.id) return;
    if (data.userId === appState.currentUser.id) return;
    
    if (data.isTyping) {
        appState.typingUsers[data.userId] = data.userName;
    } else {
        delete appState.typingUsers[data.userId];
    }
    
    updateTypingIndicator();
}

function updateTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    let indicator = document.getElementById('typingIndicator');
    
    const typingNames = Object.values(appState.typingUsers);
    
    if (typingNames.length === 0) {
        if (indicator) indicator.remove();
        return;
    }
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'text-sm text-gray-400 ml-2 mb-2';
        container.appendChild(indicator);
    }
    
    const text = typingNames.length === 1 
        ? `${typingNames[0]} is typing...`
        : `${typingNames.join(', ')} are typing...`;
    
    indicator.innerHTML = `
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
        <span class="ml-2">${text}</span>
    `;
}

// Helper Functions
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleDateString();
}

function updateProfile() {
    document.getElementById('profileName').textContent = appState.currentUser.displayName;
    document.getElementById('profileBio').textContent = appState.currentUser.aboutMe || 'No bio yet';
}

function updateParticipantCount(count) {
    document.getElementById('participantCount').textContent = count;
}

// Modal Handling
function openCreateModal() {
    document.getElementById('createDiscussionModal').classList.remove('hidden');
    document.getElementById('createDiscussionModal').classList.add('animate-slide-up');
}

function closeCreateModal() {
    document.getElementById('createDiscussionModal').classList.add('hidden');
}

async function handleCreateDiscussion(e) {
    e.preventDefault();
    
    const title = document.getElementById('discussionTitle').value.trim();
    const topic = document.getElementById('discussionTopic').value;
    
    if (!title) return;
    
    try {
        const response = await fetch('/api/forums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                topic,
                hostId: appState.currentUser.id
            })
        });
        
        if (response.ok) {
            const forum = await response.json();
            closeCreateModal();
            document.getElementById('createDiscussionForm').reset();
            joinForum(forum);
        }
    } catch (error) {
        console.error('Failed to create discussion:', error);
    }
}

async function loadFeaturedForums() {
    const featured = appState.forums
        .sort((a, b) => b.participants - a.participants)
        .slice(0, 3);
    
    const container = document.getElementById('featuredForums');
    container.innerHTML = '';
    
    featured.forEach(forum => {
        const card = document.createElement('div');
        card.className = 'forum-card glass-morphism p-4 rounded-xl cursor-pointer';
        card.innerHTML = `
            <h4 class="font-semibold">${forum.title}</h4>
            <p class="text-sm text-gray-400 mt-1">
                <i class="fas fa-users mr-1"></i>${forum.participants} participants
            </p>
        `;
        card.addEventListener('click', () => joinForum(forum));
        container.appendChild(card);
    });
}