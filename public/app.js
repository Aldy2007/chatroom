// 聊天室前端应用
class ChatApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.selectedAvatar = '😀';
        this.selectedImage = null;
        this.typingTimeout = null;
        
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
    }

    bindElements() {
        // 登录界面
        this.loginScreen = document.getElementById('login-screen');
        this.chatScreen = document.getElementById('chat-screen');
        this.usernameInput = document.getElementById('username-input');
        this.joinBtn = document.getElementById('join-btn');
        this.selectedAvatarEl = document.getElementById('selected-avatar');
        this.avatarOptions = document.querySelectorAll('.avatar-option');
        
        // 聊天界面
        this.messagesList = document.getElementById('messages-list');
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.imageInput = document.getElementById('image-input');
        this.imagePreview = document.getElementById('image-preview');
        this.previewImage = document.getElementById('preview-image');
        this.cancelImageBtn = document.getElementById('cancel-image');
        this.usersList = document.getElementById('users-list');
        this.usersCount = document.getElementById('users-count');
        this.currentUserAvatar = document.getElementById('current-user-avatar');
        this.currentUserName = document.getElementById('current-user-name');
        this.typingIndicator = document.getElementById('typing-indicator');
        
        // 侧边栏
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOpen = document.getElementById('sidebar-open');
        this.sidebarClose = document.getElementById('sidebar-close');
        
        // 图片查看器
        this.imageViewer = document.getElementById('image-viewer');
        this.viewerImage = document.getElementById('viewer-image');
        this.closeViewer = document.getElementById('close-viewer');
    }

    bindEvents() {
        // 头像选择
        this.avatarOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.selectedAvatar = option.dataset.avatar;
                this.selectedAvatarEl.textContent = this.selectedAvatar;
            });
        });

        // 加入聊天室
        this.joinBtn.addEventListener('click', () => this.joinChat());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });

        // 发送消息
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 输入状态
        this.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
            this.emitTyping();
        });

        // 图片上传
        this.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        this.cancelImageBtn.addEventListener('click', () => this.cancelImage());

        // 侧边栏切换
        this.sidebarOpen.addEventListener('click', () => this.sidebar.classList.add('open'));
        this.sidebarClose.addEventListener('click', () => this.sidebar.classList.remove('open'));

        // 图片查看器
        this.closeViewer.addEventListener('click', () => this.closeImageViewer());
        this.imageViewer.querySelector('.image-viewer-backdrop').addEventListener('click', () => this.closeImageViewer());
    }

    joinChat() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.usernameInput.focus();
            this.usernameInput.style.borderColor = '#e53e3e';
            setTimeout(() => {
                this.usernameInput.style.borderColor = '';
            }, 1000);
            return;
        }

        this.connectSocket(username);
    }

    connectSocket(username) {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('已连接到服务器');
            this.socket.emit('join', {
                username: username,
                avatar: this.selectedAvatar
            });
        });

        this.socket.on('welcome', (data) => {
            this.currentUser = data.user;
            this.showChatScreen();
            this.loadHistory();
        });

        this.socket.on('message', (message) => {
            this.addMessage(message);
        });

        this.socket.on('users', (users) => {
            this.updateUsersList(users);
        });

        this.socket.on('user-typing', (data) => {
            this.showTypingIndicator(data.username);
        });

        this.socket.on('user-stop-typing', () => {
            this.hideTypingIndicator();
        });

        this.socket.on('disconnect', () => {
            console.log('与服务器断开连接');
        });
    }

    showChatScreen() {
        this.loginScreen.classList.add('hidden');
        this.chatScreen.classList.remove('hidden');
        this.currentUserAvatar.textContent = this.currentUser.avatar;
        this.currentUserName.textContent = this.currentUser.username;
        this.messageInput.focus();
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/messages');
            const messages = await response.json();
            messages.forEach(msg => this.addMessage(msg, false));
            this.scrollToBottom();
        } catch (error) {
            console.error('加载历史消息失败:', error);
        }
    }

    addMessage(message, scroll = true) {
        const messageEl = this.createMessageElement(message);
        this.messagesList.appendChild(messageEl);
        if (scroll) {
            this.scrollToBottom();
        }
    }

    createMessageElement(message) {
        const div = document.createElement('div');

        if (message.type === 'system') {
            div.className = 'system-message';
            div.innerHTML = `<span>${this.escapeHtml(message.content)}</span>`;
            return div;
        }

        const isOwn = message.userId === this.currentUser?.id;
        div.className = `message ${isOwn ? 'own' : ''}`;

        const time = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        let contentHtml;
        if (message.type === 'image') {
            contentHtml = `<img src="${this.escapeHtml(message.content)}" alt="图片" onclick="chatApp.openImageViewer('${this.escapeHtml(message.content)}')">`;
        } else {
            contentHtml = this.escapeHtml(message.content).replace(/\n/g, '<br>');
        }

        div.innerHTML = `
            <div class="message-avatar">${message.avatar || '😀'}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username" style="color: ${message.color || '#333'}">${this.escapeHtml(message.username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-bubble">${contentHtml}</div>
            </div>
        `;

        return div;
    }

    sendMessage() {
        if (this.selectedImage) {
            this.uploadAndSendImage();
            return;
        }

        const content = this.messageInput.value.trim();
        if (!content) return;

        this.socket.emit('text-message', { content });
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        this.socket.emit('stop-typing');
    }

    async handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        // 检查文件大小 (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过 5MB');
            return;
        }

        this.selectedImage = file;
        
        // 显示预览
        const reader = new FileReader();
        reader.onload = (e) => {
            this.previewImage.src = e.target.result;
            this.imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    cancelImage() {
        this.selectedImage = null;
        this.imageInput.value = '';
        this.imagePreview.classList.add('hidden');
    }

    async uploadAndSendImage() {
        if (!this.selectedImage) return;

        const formData = new FormData();
        formData.append('image', this.selectedImage);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                this.socket.emit('image-message', { url: result.url });
                this.cancelImage();
            } else {
                alert('图片上传失败');
            }
        } catch (error) {
            console.error('上传失败:', error);
            alert('图片上传失败');
        }
    }

    updateUsersList(users) {
        this.usersCount.textContent = users.length;
        this.usersList.innerHTML = users.map(user => `
            <li class="user-item">
                <span class="user-avatar">${user.avatar}</span>
                <span class="user-name" style="color: ${user.color}">${this.escapeHtml(user.username)}</span>
                <span class="user-status"></span>
            </li>
        `).join('');
    }

    emitTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        this.socket.emit('typing');
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('stop-typing');
        }, 1000);
    }

    showTypingIndicator(username) {
        this.typingIndicator.textContent = `${username} 正在输入...`;
    }

    hideTypingIndicator() {
        this.typingIndicator.textContent = '';
    }

    adjustTextareaHeight() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 50);
    }

    openImageViewer(src) {
        this.viewerImage.src = src;
        this.imageViewer.classList.remove('hidden');
    }

    closeImageViewer() {
        this.imageViewer.classList.add('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
const chatApp = new ChatApp();
