# only reading

<div align="center">

一个基于 React 的智能英语阅读应用，集成词汇学习、字典查询和跨设备同步功能。

[功能特性](#功能特性) • [快速开始](#快速开始) • [部署指南](#部署指南) • [使用说明](#使用说明)

</div>

---

## 📖 项目介绍

only reading 是一款专为英语学习者设计的电子书阅读器，能够根据用户的词汇水平智能高亮生词，提供即时字典查询和翻译功能，并支持通过 WebDAV 在多设备间同步书籍、阅读进度和生词本。

![](./screenshots/home.jpg)

更多截图[访问](https://github.com/dongjiahong/novel/tree/main/screenshots)

## ✨ 功能特性

### 📚 阅读功能
- **多格式支持**：支持 EPUB 和 TXT 格式电子书
- **智能分页**：根据屏幕高度自动计算每页段落数
- **章节导航**：侧边栏快速跳转章节
- **阅读进度**：自动保存阅读位置

### 🎯 词汇学习
- **等级系统**：支持 CET-4、CET-6、TOEFL、IELTS 等多个词汇等级
- **智能高亮**：根据词汇等级自动标注生词（性能优化：每章最多渲染 500 个生词）
- **词典查询**：
  - 小词典（~3MB）：常用词汇，启动时加载
  - 大词典（~20MB）：完整词典，按需加载
- **生词管理**：
  - 点击生词查看释义和翻译
  - 手动标记"认识"或"不认识"
  - 自动记录到生词本

### 🔄 跨设备同步（WebDAV）
- **数据同步**：书籍、阅读进度、生词本、设置
- **冲突处理**：智能合并策略
  - 配置：最新时间戳优先，词汇列表取并集
  - 书籍：基于书名去重（同书名 = 同一本书）
  - 生词：取并集，重复词条保留最新时间戳
  - 阅读进度：按书籍单独记录，最新优先
- **增量下载**：仅下载本地缺失的书籍

## 🛠️ 技术栈

- **前端框架**：React 19
- **构建工具**：Vite 6
- **文件解析**：JSZip（EPUB）、正则表达式（TXT）
- **网络同步**：WebDAV
- **UI 组件**：Lucide React（图标）
- **状态管理**：React Context API

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 本地开发

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd novel
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   访问 `http://localhost:3000`

4. **构建生产版本**
   ```bash
   npm run build
   ```
   构建产物位于 `dist/` 目录

5. **预览生产版本**
   ```bash
   npm run preview
   ```

## 📦 部署指南

### 方式一：Nginx + 静态文件

#### 1. 构建项目
```bash
npm run build
```

#### 2. 配置 Nginx

创建或编辑 nginx 配置文件（例如 `/etc/nginx/sites-available/novel-reader`）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/novel/dist;
        try_files $uri $uri/ /index.html;

        # 强制升级 HTTP 到 HTTPS（如果使用 HTTPS）
        add_header Content-Security-Policy "upgrade-insecure-requests" always;
    }

    # WebDAV 代理（可选，用于跨域访问 WebDAV 服务器）
    location /webdav-proxy/ {
        # 替换为你的 WebDAV 服务器地址
        proxy_pass https://your-webdav-server.com/dav/;

        # 基本代理头
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # WebDAV 特殊头
        proxy_set_header Depth $http_depth;
        proxy_set_header Overwrite $http_overwrite;

        # 支持大文件上传（根据需要调整）
        client_max_body_size 100M;

        # CORS 头
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Depth, Destination, Overwrite' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        # 处理 OPTIONS 预检请求
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Depth, Destination, Overwrite' always;
            add_header 'Content-Length' '0';
            add_header 'Content-Type' 'text/plain';
            return 204;
        }
    }
}
```

#### 3. 启用配置并重启 Nginx

```bash
# 创建软链接（Ubuntu/Debian）
sudo ln -s /etc/nginx/sites-available/novel-reader /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

## 📱 使用说明

### 1. 导入书籍

1. 点击左上角的 **"Upload Book"** 按钮
2. 选择 EPUB 或 TXT 格式的电子书文件
3. 等待解析完成，书籍将出现在侧边栏

### 2. 设置词汇等级

1. 点击侧边栏的 **"Settings"** 图标（齿轮）
2. 在 **"Vocabulary Level"** 下拉框中选择你的词汇水平：
   - CET-4（大学英语四级）
   - CET-6（大学英语六级）
   - TOEFL（托福）
   - IELTS（雅思）
   - GRE
   - GMAT
3. 系统会自动标记该等级以外的词汇为生词

### 3. 阅读与学习

#### 基本操作
- **翻页**：
  - 点击页面左侧 30%：上一页
  - 点击页面右侧 30%：下一页
  - 点击章节名称：跳转章节
- **查词**：点击高亮的生词，弹出词典释义和翻译
- **管理生词**：
  - 点击 **"I know this"**：将词汇标记为已认识
  - 点击 **"I don't know this"**：将词汇添加到生词本

#### 生词高亮说明
- 橙色高亮：根据词汇等级判定的生词
- 性能优化：每章最多显示 500 个生词高亮（优先显示生词本中的词汇）
- 翻页时自动加载更多生词高亮

### 4. WebDAV 同步配置

#### 4.1 准备 WebDAV 服务器

支持的 WebDAV 服务：
- **TeraCloud**（日本老牌云存储，免费 20GB）：https://account.teracloud.jp/RegistForm.php/index/ 邀请码可以填我的 5GLSD 这样咱俩都能得到 5G 空间

#### 4.2 配置同步

1. 点击 **"Settings"** 图标
2. 在 **"WebDAV Sync Settings"** 部分填写：
   - **WebDAV URL**：你的 WebDAV 服务器地址
     - 如果使用本地代理：`http://your-domain.com/webdav-proxy/`
   - **Username**：WebDAV 用户名
   - **Password**：WebDAV 密码
3. 点击 **"Test Connection"** 测试连接
4. 启用 **"Auto Sync"** 自动同步（可选）

#### 4.3 同步数据

- **手动同步**：点击 **"Sync Now"** 按钮
- **自动同步**：启用后每 5 分钟自动同步一次

#### 4.4 同步内容

WebDAV 同步会保存以下数据：
```
/novel-reader/
├── config.json              # 用户设置（词汇等级、已知词汇）
├── books-meta.json          # 书籍元数据（书名、ID、章节数）
├── new-words.json           # 生词本
├── reading-progress.json    # 阅读进度
├── sync-metadata.json       # 同步时间戳
└── books/                   # 书籍文件
    ├── book-{hash}.txt
    └── book-{hash}.epub
```

#### 4.5 多设备使用

1. 在第一台设备上配置 WebDAV 并上传数据
2. 在第二台设备上打开应用，配置相同的 WebDAV 账号
3. 点击 **"Sync Now"**，数据将自动下载并合并
4. 每次使用前建议先同步一次，使用后再同步一次

### 5. 字典设置

- **小字典**（默认）：包含约 5 万常用词汇，体积小（~3MB），启动快
- **大字典**：包含约 20 万词汇，体积大（~20MB），需在设置中启用
  - 在 Settings 中切换 **"Dictionary Size"** 为 **"Large"**
  - 首次切换会下载大字典文件（约 20MB）


## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<div align="center">
Made with ❤️ for English learners
</div>
