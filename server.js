const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 确保必要的目录存在
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 初始化数据文件
if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(ACCOUNTS_FILE)) {
    // 初始化默认账号
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify({
        "admin": "admin123",
        "user1": "password1"
    }, null, 2));
}

// 配置 multer 用于图片上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 限制
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('只允许上传图片文件！'));
    }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.json());

// 读取消息
function getMessages() {
    try {
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// 保存消息
function saveMessage(message) {
    const messages = getMessages();
    messages.push(message);
    // 只保留最近 500 条消息
    const recentMessages = messages.slice(-500);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(recentMessages, null, 2));
    return message;
}

// 读取用户
function getUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// 保存用户
function saveUser(user) {
    const users = getUsers();
    const existingIndex = users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
        users[existingIndex] = user;
    } else {
        users.push(user);
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 读取账号配置
function getAccounts() {
    try {
        const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// 验证账号密码
function verifyAccount(username, password) {
    const accounts = getAccounts();
    return accounts.hasOwnProperty(username) && accounts[username] === password;
}

// 在线用户列表
const onlineUsers = new Map();

// API: 登录验证
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '请输入账号和密码' });
    }
    
    if (verifyAccount(username, password)) {
        res.json({ success: true, message: '登录成功' });
    } else {
        res.status(401).json({ success: false, message: '账号或密码错误' });
    }
});

// API: 获取历史消息
app.get('/api/messages', (req, res) => {
    const messages = getMessages();
    // 返回最近 100 条消息
    res.json(messages.slice(-100));
});

// API: 上传图片
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
    }
    res.json({
        success: true,
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`
    });
});

// Socket.io 连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 用户加入聊天室
    socket.on('join', (userData) => {
        const user = {
            id: socket.id,
            username: userData.username || `用户${socket.id.slice(0, 4)}`,
            avatar: userData.avatar || getRandomAvatar(),
            color: userData.color || getRandomColor(),
            joinedAt: new Date().toISOString()
        };
        
        onlineUsers.set(socket.id, user);
        saveUser(user);
        
        // 广播用户加入消息
        const joinMessage = {
            id: uuidv4(),
            type: 'system',
            content: `${user.username} 加入了聊天室`,
            timestamp: new Date().toISOString()
        };
        saveMessage(joinMessage);
        io.emit('message', joinMessage);
        
        // 发送在线用户列表
        io.emit('users', Array.from(onlineUsers.values()));
        
        // 发送欢迎消息给新用户
        socket.emit('welcome', { user, usersCount: onlineUsers.size });
    });

    // 接收文字消息
    socket.on('text-message', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const message = {
            id: uuidv4(),
            type: 'text',
            content: data.content,
            userId: user.id,
            username: user.username,
            avatar: user.avatar,
            color: user.color,
            timestamp: new Date().toISOString()
        };
        
        saveMessage(message);
        io.emit('message', message);
    });

    // 接收图片消息
    socket.on('image-message', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const message = {
            id: uuidv4(),
            type: 'image',
            content: data.url,
            userId: user.id,
            username: user.username,
            avatar: user.avatar,
            color: user.color,
            timestamp: new Date().toISOString()
        };
        
        saveMessage(message);
        io.emit('message', message);
    });

    // 用户正在输入
    socket.on('typing', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            socket.broadcast.emit('user-typing', { username: user.username });
        }
    });

    // 用户停止输入
    socket.on('stop-typing', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            socket.broadcast.emit('user-stop-typing', { username: user.username });
        }
    });

    // 用户断开连接
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            onlineUsers.delete(socket.id);
            
            const leaveMessage = {
                id: uuidv4(),
                type: 'system',
                content: `${user.username} 离开了聊天室`,
                timestamp: new Date().toISOString()
            };
            saveMessage(leaveMessage);
            io.emit('message', leaveMessage);
            io.emit('users', Array.from(onlineUsers.values()));
        }
        console.log('用户断开:', socket.id);
    });
});

// 随机头像
function getRandomAvatar() {
    const avatars = ['😀', '😎', '🤖', '👻', '🦊', '🐱', '🐶', '🐼', '🦁', '🐯', '🐨', '🐸', '🐵', '🦄', '🐲'];
    return avatars[Math.floor(Math.random() * avatars.length)];
}

// 随机颜色
function getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    return colors[Math.floor(Math.random() * colors.length)];
}

server.listen(PORT, () => {
    console.log(`🚀 聊天室服务器运行在 http://localhost:${PORT}`);
});
