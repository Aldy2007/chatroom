# 🗨️ 多人聊天室

一个基于 Node.js + Socket.io 的实时多人聊天室应用。

## ✨ 功能特性

- 🔐 **用户系统** - 自定义昵称和表情头像
- 💬 **实时聊天** - 基于 WebSocket 的即时通讯
- 🖼️ **图片支持** - 发送和查看图片消息
- 👥 **多用户** - 支持多人同时在线聊天
- 📱 **响应式设计** - 适配桌面和移动设备
- 💾 **消息持久化** - 消息以 JSON 格式存储在本地

## 🚀 快速开始

### 安装依赖

```bash
yarn install
```

### 启动服务器

```bash
yarn start
```

服务器将在 `http://localhost:3000` 启动。

## 📁 项目结构

```
chatroom/
├── server.js           # 服务器端代码
├── package.json        # 项目配置
├── public/             # 前端静态文件
│   ├── index.html      # 主页面
│   ├── style.css       # 样式文件
│   └── app.js          # 前端逻辑
├── data/               # 数据存储
│   ├── messages.json   # 聊天消息
│   └── users.json      # 用户信息
└── uploads/            # 上传的图片
```

## 🔧 技术栈

- **后端**: Node.js + Express + Socket.io
- **前端**: HTML5 + CSS3 + JavaScript
- **存储**: JSON 文件存储

## 📝 使用说明

1. 打开浏览器访问 `http://localhost:3000`
2. 选择一个表情头像
3. 输入你的昵称
4. 点击"进入聊天室"开始聊天
5. 支持发送文字消息和图片

## 🎨 界面预览

- 现代简洁的 UI 设计
- 渐变色背景和卡片式布局
- 平滑的动画效果
- 实时显示在线用户列表
- 用户输入状态提示

## ⚙️ 配置

默认端口为 `3000`，可通过环境变量修改：

```bash
PORT=8080 yarn start
```

## 📄 License

MIT