/* script.js - Upgraded v2.0 */

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// App State with enhanced features
const appState = {
    currentUser: null,
    currentRoom: null,
    forums: [],
    messages: {},
    messageCount: 0,
    discussionsJoined: new Set(),
    eventSource: null,
    typingUsers: {},
    isOnline: navigator.onLine,
    pendingMessages: [],
    keyboardShortcuts: new Map(),
    performanceMetrics: {
        messageLoadTime: 0,
        connectionTime: 0,
        lastActivity: Date.now()
    }
};

// Performance monitoring
const performance = {
    mark(name) {
        if (window.performance && window.performance.mark) {
            window.performance.mark(name);
        }
    },
    measure(name, startMark, endMark) {
        if (window.performance && window.performance.measure) {
            try {
                window.performance.measure(name, startMark, endMark);
                const measure = window.performance.getEntriesByName(name)[0];
                return measure.duration;
            } catch (error) {
                console.error('Performance measurement failed:', error);
                return 0;
            }
        }
        return 0;
    }
};

// Initialize App with enhanced features
document.addEventListener('DOMContentLoaded', () => {
    performance.mark('app-init-start');
    
    initializeEventListeners();
    initializeKeyboardShortcuts();
    initializeOfflineSupport();
    loadUserSession();
    
    // Test API connectivity
    testAPIConnectivity();
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.error('SW registration failed:', error);
            });
    }
    
    performance.mark('app-init-end');
    performance.measure('app-initialization', 'app-init-start', 'app-init-end');
});

// Test API connectivity
async function testAPIConnectivity() {
    try {
        console.log('Testing API connectivity...');
        
        // Test the simple test endpoint first
        console.log('Testing /api/test...');
        const testResponse = await fetch('/api/test', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('Test API response status:', testResponse.status);
        console.log('Test API response URL:', testResponse.url);
        
        if (testResponse.ok) {
            const testData = await testResponse.json();
            console.log('✅ Test API is working:', testData);
        } else {
            console.error('❌ Test API returned error status:', testResponse.status);
        }
        
        // Test the auth endpoint
        console.log('Testing /api/auth...');
        const response = await fetch('/api/auth', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('Auth API response status:', response.status);
        console.log('Auth API response URL:', response.url);
        
        if (response.ok) {
            console.log('✅ Auth API is accessible');
        } else {
            console.error('❌ Auth API returned error status:', response.status);
        }
    } catch (error) {
        console.error('❌ API connectivity test failed:', error);
    }
}

// Enhanced Event Listeners with performance tracking
function initializeEventListeners() {
    try {
        console.log('Initializing event listeners...');
        
        // Join Form
        const joinForm = document.getElementById('joinForm');
        console.log('Join form found:', joinForm);
        
        if (joinForm) {
            joinForm.addEventListener('submit', handleJoin);
            console.log('Submit event listener attached to join form');
        } else {
            console.error('Join form not found!');
        }
        
        // Navigation with enhanced accessibility
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => navigateToScreen(btn.dataset.screen));
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigateToScreen(btn.dataset.screen);
                }
            });
        });
        
        // Discussion Creation
        const startDiscussionBtn = document.getElementById('startDiscussionBtn');
        const createDiscussionForm = document.getElementById('createDiscussionForm');
        
        if (startDiscussionBtn) {
            startDiscussionBtn.addEventListener('click', openCreateModal);
        }
        
        if (createDiscussionForm) {
            createDiscussionForm.addEventListener('submit', handleCreateDiscussion);
        }
        
        // Chat with enhanced features
        const messageForm = document.getElementById('messageForm');
        const exitRoomBtn = document.getElementById('exitRoomBtn');
        const messageInput = document.getElementById('messageInput');
        
        if (messageForm) {
            messageForm.addEventListener('submit', sendMessage);
        }
        
        if (exitRoomBtn) {
            exitRoomBtn.addEventListener('click', exitRoom);
        }
        
        if (messageInput) {
            messageInput.addEventListener('input', handleTyping);
            messageInput.addEventListener('keydown', handleMessageKeydown);
        }
        
        // Topic Filters with enhanced UX
        document.querySelectorAll('.topic-filter').forEach(filter => {
            filter.addEventListener('click', () => filterByTopic(filter.dataset.topic));
        });
        
        // Profile
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', signOut);
        }
        
        // Search functionality
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', toggleSearch);
        }
        
        // Notification functionality
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', toggleNotifications);
        }
        
        // Search input in discover screen
        const searchInput = document.querySelector('#discoverScreen input[type="search"]');
        if (searchInput) {
            if (typeof debounce === 'function') {
                searchInput.addEventListener('input', debounce(handleSearch, 300));
            } else {
                console.warn('Debounce function not available, using direct event listener');
                searchInput.addEventListener('input', handleSearch);
            }
        }
        
        // Modal close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeCreateModal();
            }
        });
        
        // Online/offline status
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
        
        // Page visibility API
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        console.log('Event listeners initialized successfully');
    } catch (error) {
        console.error('Error initializing event listeners:', error);
    }
}

// Keyboard shortcuts
function initializeKeyboardShortcuts() {
    appState.keyboardShortcuts.set('Ctrl+Enter', () => {
        const messageInput = document.getElementById('messageInput');
        if (messageInput && document.activeElement === messageInput) {
            sendMessage(new Event('submit'));
        }
    });
    
    appState.keyboardShortcuts.set('Ctrl+/', () => {
        toggleSearch();
    });
    
    appState.keyboardShortcuts.set('Ctrl+Escape', () => {
        if (appState.currentRoom) {
            exitRoom();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.key}`;
        const shortcut = appState.keyboardShortcuts.get(key);
        if (shortcut) {
            e.preventDefault();
            shortcut();
        }
    });
}

// Enhanced message input handling
function handleMessageKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(new Event('submit'));
    }
}

// Offline support
function initializeOfflineSupport() {
    // Store pending messages for when connection is restored
    window.addEventListener('beforeunload', () => {
        if (appState.pendingMessages.length > 0) {
            localStorage.setItem('pendingMessages', JSON.stringify(appState.pendingMessages));
        }
    });
    
    // Restore pending messages on load
    const pending = localStorage.getItem('pendingMessages');
    if (pending) {
        try {
            appState.pendingMessages = JSON.parse(pending);
            localStorage.removeItem('pendingMessages');
        } catch (error) {
            console.error('Failed to restore pending messages:', error);
        }
    }
}

function handleOnlineStatus() {
    appState.isOnline = true;
    showToast('Connection restored', 'success');
    
    // Send pending messages
    if (appState.pendingMessages.length > 0) {
        appState.pendingMessages.forEach(msg => {
            sendMessageFromQueue(msg);
        });
        appState.pendingMessages = [];
    }
}

function handleOfflineStatus() {
    appState.isOnline = false;
    showToast('You are offline. Messages will be sent when connection is restored.', 'warning');
}

function handleVisibilityChange() {
    if (document.hidden) {
        // User switched tabs/windows
        appState.performanceMetrics.lastActivity = Date.now();
    } else {
        // User returned to the app
        const timeAway = Date.now() - appState.performanceMetrics.lastActivity;
        if (timeAway > 30000) { // 30 seconds
            // Refresh data if user was away for a while
            if (appState.currentUser) {
                loadForums();
                if (appState.currentRoom) {
                    loadMessages(appState.currentRoom.id);
                }
            }
        }
    }
}

// Enhanced SSE connection with better error handling
function connectToSSE() {
    if (appState.eventSource) {
        appState.eventSource.close();
    }
    
    performance.mark('sse-connect-start');
    
    try {
        appState.eventSource = new EventSource(`/api/sse?userId=${appState.currentUser.id}`);
        
        appState.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleServerEvent(data);
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };
        
        appState.eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            setTimeout(() => {
                if (appState.currentUser) {
                    connectToSSE();
                }
            }, 5000);
        };
        
        appState.eventSource.onopen = () => {
            console.log('SSE connection established');
            performance.mark('sse-connect-end');
            appState.performanceMetrics.connectionTime = performance.measure('sse-connection', 'sse-connect-start', 'sse-connect-end');
        };
    } catch (error) {
        console.error('Failed to establish SSE connection:', error);
        setTimeout(() => {
            if (appState.currentUser) {
                connectToSSE();
            }
        }, 5000);
    }
}

function handleServerEvent(data) {
    if (!data || !data.type) {
        console.error('Invalid server event data:', data);
        return;
    }
    
    try {
        switch(data.type) {
            case 'message':
                if (data.roomId === appState.currentRoom?.id && data.message) {
                    displayMessage(data.message);
                }
                break;
            case 'message_edited':
                if (data.roomId === appState.currentRoom?.id && data.message) {
                    updateMessageInUI(data.message);
                }
                break;
            case 'message_deleted':
                if (data.roomId === appState.currentRoom?.id && data.messageId) {
                    removeMessageFromUI(data.messageId);
                }
                break;
            case 'user_joined':
                if (data.roomId === appState.currentRoom?.id) {
                    addSystemMessage(`${data.userName || 'Someone'} joined the discussion`);
                    updateParticipantCount(data.participants);
                }
                break;
            case 'user_left':
                if (data.roomId === appState.currentRoom?.id) {
                    addSystemMessage(`${data.userName || 'Someone'} left the discussion`);
                    updateParticipantCount(data.participants);
                }
                break;
            case 'typing':
                handleTypingIndicator(data);
                break;
            case 'forum_created':
                if (data.forum) {
                    appState.forums.unshift(data.forum);
                    displayForums();
                }
                break;
            default:
                console.log('Unknown event type:', data.type);
        }
    } catch (error) {
        console.error('Error handling server event:', error);
    }
}

// User Authentication
async function handleJoin(e) {
    console.log('handleJoin called', e);
    e.preventDefault();
    
    const displayName = document.getElementById('displayName');
    const aboutMe = document.getElementById('aboutMe');
    
    console.log('Form elements found:', { displayName, aboutMe });
    
    if (!displayName || !aboutMe) {
        console.error('Form elements not found');
        return;
    }
    
    const displayNameValue = displayName.value.trim();
    const aboutMeValue = aboutMe.value.trim();
    
    console.log('Form values:', { displayNameValue, aboutMeValue });
    
    if (!displayNameValue) {
        console.log('Display name is empty');
        return;
    }
    
    const interests = [];
    document.querySelectorAll('.interest-tag input:checked').forEach(input => {
        interests.push(input.value);
    });
    
    console.log('Selected interests:', interests);
    
    try {
        console.log('Attempting to join with:', { displayNameValue, aboutMeValue, interests });
        
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: displayNameValue, aboutMe: aboutMeValue, interests })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        console.log('Response URL:', response.url);
        console.log('Response type:', response.type);
        console.log('Response redirected:', response.redirected);
        
        // Get the raw response text first
        const responseText = await response.text();
        console.log('Raw response text (first 200 chars):', responseText.substring(0, 200));
        console.log('Response text length:', responseText.length);
        
        if (!response.ok) {
            console.error('Response not ok, status:', response.status);
            console.error('Full response text:', responseText);
            
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                errorData = { error: `Server error (${response.status}): ${responseText.substring(0, 100)}...` };
            }
            
            console.error('Server error:', errorData);
            alert(`Sign-in failed: ${errorData.error || 'Unknown error'}`);
            return;
        }
        
        console.log('Response text:', responseText);
        
        let user;
        try {
            user = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse user data as JSON:', parseError);
            console.error('Response that failed to parse:', responseText);
            alert('Sign-in failed: Invalid response from server');
            return;
        }
        
        console.log('User created successfully:', user);
        
        appState.currentUser = user;
        localStorage.setItem('forumUser', JSON.stringify(user));
        
        showMainScreen();
        connectToSSE();
        loadForums();
    } catch (error) {
        console.error('Join failed:', error);
        alert(`Sign-in failed: ${error.message}`);
    }
}

async function loadUserSession() {
    const savedUser = localStorage.getItem('forumUser');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        console.log('Found saved user:', user);
        
        try {
            const response = await fetch(`/api/auth?userId=${user.id}`);
            console.log('Session check response status:', response.status);
            
            if (response.ok) {
                const updatedUser = await response.json();
                console.log('Session restored successfully:', updatedUser);
                appState.currentUser = updatedUser;
                showMainScreen();
                connectToSSE();
                loadForums();
            } else {
                console.log('Session invalid, removing from localStorage');
                localStorage.removeItem('forumUser');
            }
        } catch (error) {
            console.error('Session check failed:', error);
            localStorage.removeItem('forumUser');
        }
    } else {
        console.log('No saved user found');
    }
}

async function signOut() {
    try {
        if (appState.currentUser) {
            const response = await fetch('/api/auth', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: appState.currentUser.id })
            });
            
            if (!response.ok) {
                console.error('Failed to sign out user:', response.status);
            }
        }
        
        localStorage.removeItem('forumUser');
        
        if (appState.eventSource) {
            appState.eventSource.close();
        }
        
        location.reload();
    } catch (error) {
        console.error('Error signing out:', error);
        // Still try to clear local data and reload
        localStorage.removeItem('forumUser');
        if (appState.eventSource) {
            appState.eventSource.close();
        }
        location.reload();
    }
}

// Screen Navigation
function showMainScreen() {
    try {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const discussionsScreen = document.getElementById('discussionsScreen');
        const mainHeader = document.getElementById('mainHeader');
        const bottomNav = document.getElementById('bottomNav');
        
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (discussionsScreen) discussionsScreen.classList.remove('hidden');
        if (mainHeader) mainHeader.classList.remove('hidden');
        if (bottomNav) bottomNav.classList.remove('hidden');
        
        updateProfile();
    } catch (error) {
        console.error('Error showing main screen:', error);
    }
}

function navigateToScreen(screen) {
    try {
        const screens = ['discussionsScreen', 'discoverScreen', 'activityScreen', 'profileScreen'];
        screens.forEach(s => {
            const element = document.getElementById(s);
            if (element) {
                element.classList.add('hidden');
            }
        });
        
        const targetScreen = document.getElementById(screen + 'Screen');
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
        }
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screen);
        });
        
        if (screen === 'activity') {
            const discussionsJoined = document.getElementById('discussionsJoined');
            const messagesCount = document.getElementById('messagesCount');
            
            if (discussionsJoined) {
                discussionsJoined.textContent = appState.discussionsJoined.size || 0;
            }
            if (messagesCount) {
                messagesCount.textContent = appState.messageCount || 0;
            }
        }
        
        if (screen === 'discover') {
            loadFeaturedForums();
        }
    } catch (error) {
        console.error('Error navigating to screen:', error);
    }
}

// Forum Management
async function loadForums() {
    try {
        const response = await fetch('/api/forums');
        
        if (!response.ok) {
            console.error('Failed to load forums:', response.status);
            return;
        }
        
        const forums = await response.json();
        appState.forums = forums;
        displayForums();
    } catch (error) {
        console.error('Failed to load forums:', error);
    }
}

function displayForums(filter = 'all') {
    try {
        const forumsList = document.getElementById('forumsList');
        if (!forumsList) {
            console.error('Forums list container not found');
            return;
        }
        
        forumsList.innerHTML = '';
        
        if (!Array.isArray(appState.forums)) {
            console.error('Forums data is not an array:', appState.forums);
            return;
        }
        
        const filteredForums = filter === 'all' 
            ? appState.forums 
            : appState.forums.filter(f => f && f.topic === filter);
        
        if (filteredForums.length === 0) {
            forumsList.innerHTML = '<div class="text-center text-gray-400 py-8">No forums available</div>';
            return;
        }
        
        filteredForums.forEach(forum => {
            if (!forum || !forum.title) {
                console.error('Invalid forum data:', forum);
                return;
            }
            
            const forumCard = document.createElement('div');
            forumCard.className = 'forum-card glass-morphism p-4 rounded-xl cursor-pointer';
            forumCard.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-semibold text-lg flex-1">${forum.title}</h3>
                    ${forum.participants > 0 ? '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded-full">LIVE</span>' : ''}
                </div>
                <div class="flex items-center justify-between text-sm text-gray-400">
                    <span><i class="fas fa-user mr-1"></i>${forum.host || 'Unknown'}</span>
                    <span><i class="fas fa-users mr-1"></i>${forum.participants || 0}</span>
                </div>
                <div class="mt-2">
                    <span class="text-xs bg-gray-800 px-2 py-1 rounded-full">${forum.topic || 'general'}</span>
                </div>
            `;
            
            forumCard.addEventListener('click', () => joinForum(forum));
            forumsList.appendChild(forumCard);
        });
    } catch (error) {
        console.error('Error displaying forums:', error);
    }
}

function filterByTopic(topic) {
    try {
        document.querySelectorAll('.topic-filter').forEach(btn => {
            if (btn.dataset.topic === topic) {
                btn.classList.add('bg-purple-600', 'text-white');
                btn.classList.remove('bg-gray-800');
            } else {
                btn.classList.remove('bg-purple-600', 'text-white');
                btn.classList.add('bg-gray-800');
            }
        });
        
        loadForumsWithFilter(topic);
    } catch (error) {
        console.error('Error filtering by topic:', error);
    }
}

async function loadForumsWithFilter(topic = 'all') {
    try {
        let url = '/api/forums';
        const params = new URLSearchParams();
        
        if (topic && topic !== 'all') {
            params.append('topic', topic);
        }
        
        if (topic === 'trending') {
            params.append('trending', 'true');
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('Failed to load forums:', response.status);
            return;
        }
        
        const forums = await response.json();
        appState.forums = forums;
        displayForums();
    } catch (error) {
        console.error('Failed to load forums with filter:', error);
    }
}

async function joinForum(forum) {
    try {
        const response = await fetch(`/api/forums/${forum.id}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: appState.currentUser.id })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to join forum:', errorData);
            alert(`Failed to join forum: ${errorData.error || 'Unknown error'}`);
            return;
        }
        
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
    } catch (error) {
        console.error('Failed to join forum:', error);
        alert('Failed to join forum. Please try again.');
    }
}

async function exitRoom() {
    try {
        if (appState.currentRoom && appState.currentUser) {
            const response = await fetch(`/api/forums/${appState.currentRoom.id}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: appState.currentUser.id })
            });
            
            if (!response.ok) {
                console.error('Failed to leave forum:', response.status);
            }
        }
        
        const discussionRoom = document.getElementById('discussionRoom');
        const discussionsScreen = document.getElementById('discussionsScreen');
        const bottomNav = document.getElementById('bottomNav');
        const messagesContainer = document.getElementById('messagesContainer');
        
        if (discussionRoom) discussionRoom.classList.add('hidden');
        if (discussionsScreen) discussionsScreen.classList.remove('hidden');
        if (bottomNav) bottomNav.classList.remove('hidden');
        if (messagesContainer) messagesContainer.innerHTML = '';
        
        appState.currentRoom = null;
        loadForums();
    } catch (error) {
        console.error('Error exiting room:', error);
        // Still try to show the main screen even if the API call fails
        const discussionRoom = document.getElementById('discussionRoom');
        const discussionsScreen = document.getElementById('discussionsScreen');
        const bottomNav = document.getElementById('bottomNav');
        
        if (discussionRoom) discussionRoom.classList.add('hidden');
        if (discussionsScreen) discussionsScreen.classList.remove('hidden');
        if (bottomNav) bottomNav.classList.remove('hidden');
        
        appState.currentRoom = null;
    }
}

// Message Handling
async function loadMessages(forumId) {
    try {
        const response = await fetch(`/api/messages?forumId=${forumId}`);
        
        if (!response.ok) {
            console.error('Failed to load messages:', response.status);
            return;
        }
        
        const data = await response.json();
        const messages = data.messages || data; // Handle both response formats
        
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        
        if (Array.isArray(messages)) {
            messages.forEach(msg => displayMessage(msg));
            
            if (messages.length === 0) {
                addSystemMessage(`Welcome to "${appState.currentRoom.title}"! Start the conversation.`);
            }
        }
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Failed to load messages:', error);
        addSystemMessage('Failed to load messages. Please try again.');
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
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                forumId: appState.currentRoom.id,
                userId: appState.currentUser.id,
                text
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to send message:', errorData);
            input.value = text; // Restore the text
            return;
        }
        
        appState.messageCount++;
    } catch (error) {
        console.error('Failed to send message:', error);
        input.value = text; // Restore the text
    } finally {
        input.disabled = false;
        input.focus();
    }
}

function displayMessage(message) {
    if (!message || !message.text) {
        console.error('Invalid message data:', message);
        return;
    }
    
    const container = document.getElementById('messagesContainer');
    if (!container) {
        console.error('Messages container not found');
        return;
    }
    
    const isOwn = message.userId === appState.currentUser?.id;
    
    const messageEl = document.createElement('div');
    messageEl.className = `message-bubble ${isOwn ? 'ml-auto' : 'mr-auto'} max-w-xs`;
    messageEl.dataset.messageId = message.id;
    
    const editedText = message.edited ? ' (edited)' : '';
    
    messageEl.innerHTML = `
        <div class="${isOwn ? 'own-message' : 'other-message'} px-4 py-2 rounded-2xl relative group">
            ${!isOwn ? `<p class="text-xs opacity-70 mb-1">${message.userName || 'Unknown'}</p>` : ''}
            <p class="text-sm">${message.text}</p>
            <p class="text-xs opacity-50 mt-1">${formatTime(message.timestamp)}${editedText}</p>
            ${isOwn ? `
                <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="message-edit-btn text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mr-1">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="message-delete-btn text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    // Add event listeners for edit/delete buttons
    if (isOwn) {
        const editBtn = messageEl.querySelector('.message-edit-btn');
        const deleteBtn = messageEl.querySelector('.message-delete-btn');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => editMessage(message));
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteMessage(message.id));
        }
    }
    
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

function addSystemMessage(text) {
    try {
        const container = document.getElementById('messagesContainer');
        if (!container) {
            console.error('Messages container not found');
            return;
        }
        
        if (!text) {
            console.error('System message text is required');
            return;
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = 'text-center text-xs text-gray-500 my-2';
        messageEl.textContent = text;
        container.appendChild(messageEl);
    } catch (error) {
        console.error('Error adding system message:', error);
    }
}

// Typing Indicator
let typingTimer;
function handleTyping() {
    if (!appState.currentRoom || !appState.currentUser) return;
    
    clearTimeout(typingTimer);
    
    try {
        fetch('/api/messages/typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                forumId: appState.currentRoom.id,
                userId: appState.currentUser.id
            })
        }).catch(error => {
            console.error('Failed to send typing indicator:', error);
        });
        
        typingTimer = setTimeout(() => {
            fetch('/api/messages/typing', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    forumId: appState.currentRoom.id,
                    userId: appState.currentUser.id
                })
            }).catch(error => {
                console.error('Failed to stop typing indicator:', error);
            });
        }, 2000);
    } catch (error) {
        console.error('Error handling typing:', error);
    }
}

function handleTypingIndicator(data) {
    if (!data || !data.roomId || !data.userId) {
        console.error('Invalid typing indicator data:', data);
        return;
    }
    
    if (data.roomId !== appState.currentRoom?.id) return;
    
    try {
        if (data.isTyping) {
            appState.typingUsers[data.userId] = data.userName || 'Someone';
        } else {
            delete appState.typingUsers[data.userId];
        }
        
        updateTypingIndicator();
    } catch (error) {
        console.error('Error handling typing indicator:', error);
    }
}

function updateTypingIndicator() {
    try {
        const typingIndicator = document.getElementById('typingIndicator');
        if (!typingIndicator) {
            console.error('Typing indicator element not found');
            return;
        }
        
        const typingUsers = Object.values(appState.typingUsers || {});
        
        if (typingUsers.length === 0) {
            typingIndicator.classList.add('hidden');
            return;
        }
        
        let text = '';
        if (typingUsers.length === 1) {
            text = `${typingUsers[0]} is typing...`;
        } else if (typingUsers.length === 2) {
            text = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
        } else {
            text = `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
        }
        
        typingIndicator.textContent = text;
        typingIndicator.classList.remove('hidden');
    } catch (error) {
        console.error('Error updating typing indicator:', error);
    }
}

// Helper Functions
function formatTime(timestamp) {
    if (!timestamp) {
        return 'Just now';
    }
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return 'Just now';
        }
        
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'Just now';
    }
}

function updateProfile() {
    if (!appState.currentUser) {
        console.error('No current user to update profile');
        return;
    }
    
    try {
        const profileName = document.getElementById('profileName');
        const profileBio = document.getElementById('profileBio');
        const connectionsCount = document.getElementById('connectionsCount');
        
        if (profileName) {
            profileName.textContent = appState.currentUser.displayName || 'Unknown User';
        }
        
        if (profileBio) {
            profileBio.textContent = appState.currentUser.aboutMe || 'No bio available';
        }
        
        if (connectionsCount) {
            // Calculate connections based on forums joined
            const connections = appState.discussionsJoined.size || 0;
            connectionsCount.textContent = connections;
        }
    } catch (error) {
        console.error('Error updating profile:', error);
    }
}

function updateParticipantCount(count) {
    try {
        const countElement = document.getElementById('participantCount');
        if (countElement) {
            countElement.textContent = count || 0;
        }
    } catch (error) {
        console.error('Error updating participant count:', error);
    }
}

// Modal Handling
function openCreateModal() {
    try {
        const modal = document.getElementById('createDiscussionModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error opening create modal:', error);
    }
}

function closeCreateModal() {
    try {
        const modal = document.getElementById('createDiscussionModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error closing create modal:', error);
    }
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
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to create discussion:', errorData);
            alert(`Failed to create discussion: ${errorData.error || 'Unknown error'}`);
            return;
        }
        
        const forum = await response.json();
        closeCreateModal();
        document.getElementById('createDiscussionForm').reset();
        joinForum(forum);
    } catch (error) {
        console.error('Failed to create discussion:', error);
        alert('Failed to create discussion. Please try again.');
    }
}

async function loadFeaturedForums() {
    try {
        const response = await fetch('/api/forums');
        
        if (!response.ok) {
            console.error('Failed to load featured forums:', response.status);
            return;
        }
        
        const forums = await response.json();
        
        if (!Array.isArray(forums)) {
            console.error('Featured forums data is not an array:', forums);
            return;
        }
        
        // Filter for featured/active forums
        const featuredForums = forums.filter(f => f && f.participants > 0).slice(0, 5);
        
        const container = document.getElementById('featuredForums');
        if (!container) {
            console.error('Featured forums container not found');
            return;
        }
        
        container.innerHTML = '';
        
        if (featuredForums.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-8">No active forums</div>';
            return;
        }
        
        featuredForums.forEach(forum => {
            if (!forum || !forum.title) return;
            
            const forumCard = document.createElement('div');
            forumCard.className = 'forum-card glass-morphism p-4 rounded-xl cursor-pointer';
            forumCard.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-semibold text-lg flex-1">${forum.title}</h3>
                    <span class="text-xs bg-green-500 text-white px-2 py-1 rounded-full">LIVE</span>
                </div>
                <div class="flex items-center justify-between text-sm text-gray-400">
                    <span><i class="fas fa-user mr-1"></i>${forum.host || 'Unknown'}</span>
                    <span><i class="fas fa-users mr-1"></i>${forum.participants || 0}</span>
                </div>
                <div class="mt-2">
                    <span class="text-xs bg-gray-800 px-2 py-1 rounded-full">${forum.topic || 'general'}</span>
                </div>
            `;
            
            forumCard.addEventListener('click', () => joinForum(forum));
            container.appendChild(forumCard);
        });
    } catch (error) {
        console.error('Failed to load featured forums:', error);
    }
}

// Search and Notification Functions
function toggleSearch() {
    try {
        const discoverScreen = document.getElementById('discoverScreen');
        if (discoverScreen) {
            navigateToScreen('discover');
            const searchInput = discoverScreen.querySelector('input[type="search"]');
            if (searchInput) {
                searchInput.focus();
            }
        }
    } catch (error) {
        console.error('Error toggling search:', error);
    }
}

function toggleNotifications() {
    try {
        // For now, just show a placeholder notification
        alert('Notifications feature coming soon!');
        
        // Hide notification dot
        const notificationDot = document.getElementById('notificationDot');
        if (notificationDot) {
            notificationDot.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error toggling notifications:', error);
    }
}

function handleSearch(e) {
    try {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (searchTerm.length === 0) {
            loadFeaturedForums();
            return;
        }
        
        // Filter forums based on search term
        const filteredForums = appState.forums.filter(forum => 
            forum.title.toLowerCase().includes(searchTerm) ||
            forum.topic.toLowerCase().includes(searchTerm) ||
            forum.host.toLowerCase().includes(searchTerm)
        );
        
        displaySearchResults(filteredForums, searchTerm);
    } catch (error) {
        console.error('Error handling search:', error);
    }
}

function displaySearchResults(forums, searchTerm) {
    try {
        const container = document.getElementById('featuredForums');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (forums.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-search text-2xl mb-2"></i>
                    <p>No forums found for "${searchTerm}"</p>
                </div>
            `;
            return;
        }
        
        forums.forEach(forum => {
            if (!forum || !forum.title) return;
            
            const forumCard = document.createElement('div');
            forumCard.className = 'forum-card glass-morphism p-4 rounded-xl cursor-pointer';
            forumCard.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-semibold text-lg flex-1">${forum.title}</h3>
                    ${forum.participants > 0 ? '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded-full">LIVE</span>' : ''}
                </div>
                <div class="flex items-center justify-between text-sm text-gray-400">
                    <span><i class="fas fa-user mr-1"></i>${forum.host || 'Unknown'}</span>
                    <span><i class="fas fa-users mr-1"></i>${forum.participants || 0}</span>
                </div>
                <div class="mt-2">
                    <span class="text-xs bg-gray-800 px-2 py-1 rounded-full">${forum.topic || 'general'}</span>
                </div>
            `;
            
            forumCard.addEventListener('click', () => joinForum(forum));
            container.appendChild(forumCard);
        });
    } catch (error) {
        console.error('Error displaying search results:', error);
    }
}

// Message Management Functions
async function editMessage(message) {
    try {
        const newText = prompt('Edit your message:', message.text);
        
        if (!newText || newText.trim() === message.text.trim()) {
            return;
        }
        
        const response = await fetch('/api/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messageId: message.id,
                userId: appState.currentUser.id,
                text: newText.trim()
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            alert(`Failed to edit message: ${errorData.error || 'Unknown error'}`);
            return;
        }
        
        // Update the message in the UI
        const messageEl = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageEl) {
            const textEl = messageEl.querySelector('p:nth-child(2)');
            const timeEl = messageEl.querySelector('p:nth-child(3)');
            
            if (textEl) textEl.textContent = newText.trim();
            if (timeEl) timeEl.textContent = `${formatTime(new Date().toISOString())} (edited)`;
        }
    } catch (error) {
        console.error('Error editing message:', error);
        alert('Failed to edit message. Please try again.');
    }
}

async function deleteMessage(messageId) {
    try {
        if (!confirm('Are you sure you want to delete this message?')) {
            return;
        }
        
        const response = await fetch('/api/messages', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messageId,
                userId: appState.currentUser.id
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            alert(`Failed to delete message: ${errorData.error || 'Unknown error'}`);
            return;
        }
        
        // Remove the message from the UI
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.remove();
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message. Please try again.');
    }
}

// UI Update Functions for Message Events
function updateMessageInUI(message) {
    try {
        const messageEl = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageEl) {
            const textEl = messageEl.querySelector('p:nth-child(2)');
            const timeEl = messageEl.querySelector('p:nth-child(3)');
            
            if (textEl) textEl.textContent = message.text;
            if (timeEl) timeEl.textContent = `${formatTime(message.timestamp)} (edited)`;
        }
    } catch (error) {
        console.error('Error updating message in UI:', error);
    }
}

function removeMessageFromUI(messageId) {
    try {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.remove();
        }
    } catch (error) {
        console.error('Error removing message from UI:', error);
    }
}

// Enhanced loading states
function showLoading(elementId, text = 'Loading...') {
    try {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('loading');
            element.setAttribute('data-original-text', element.textContent);
            element.textContent = text;
            element.disabled = true;
        }
    } catch (error) {
        console.error('Error showing loading state:', error);
    }
}

function hideLoading(elementId) {
    try {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('loading');
            const originalText = element.getAttribute('data-original-text');
            if (originalText) {
                element.textContent = originalText;
                element.removeAttribute('data-original-text');
            }
            element.disabled = false;
        }
    } catch (error) {
        console.error('Error hiding loading state:', error);
    }
}

// Enhanced toast notifications
function showToast(message, type = 'info') {
    try {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white max-w-sm transition-all duration-300 transform translate-x-full`;
        
        const bgColor = type === 'error' ? 'bg-red-500' : 
                       type === 'success' ? 'bg-green-500' : 
                       type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
        
        toast.className += ` ${bgColor}`;
        
        const icon = type === 'error' ? 'fas fa-exclamation-circle' :
                    type === 'success' ? 'fas fa-check-circle' :
                    type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle';
        
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="${icon} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 4000);
    } catch (error) {
        console.error('Error showing toast:', error);
    }
}