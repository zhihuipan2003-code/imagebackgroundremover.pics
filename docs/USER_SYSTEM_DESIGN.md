# 用户体系设计文档 (已部署)

## 1. 数据库设计

### 1.1 用户表 (users)
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- Google OAuth 用户ID
    email TEXT UNIQUE NOT NULL,             -- 邮箱地址
    name TEXT NOT NULL,                     -- 显示名称
    picture TEXT,                           -- 头像URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**功能说明：**
- 存储从 Google OAuth 获取的用户基本信息
- 用户首次登录时自动创建记录
- email 唯一索引，确保每个邮箱只能有一个账号

### 1.2 用户设置表 (user_settings)
```sql
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,               -- 外键关联 users.id
    api_key TEXT,                           -- remove.bg API Key (需加密)
    default_output_format TEXT DEFAULT 'png', -- 默认输出格式 (png/jpg/webp)
    default_size TEXT DEFAULT 'auto',       -- 默认尺寸 (auto/preview/full)
    theme TEXT DEFAULT 'light',             -- 主题 (light/dark)
    language TEXT DEFAULT 'zh-CN',          -- 语言 (zh-CN/en/...)
    notify_on_completion INTEGER DEFAULT 1, -- 完成通知 (0/1)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**功能说明：**
- 存储用户的个性化设置
- 每个用户只有一条设置记录
- API Key 可留空（使用系统默认）

### 1.3 处理历史表 (processing_history)
```sql
CREATE TABLE processing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                  -- 外键关联 users.id
    original_url TEXT,                      -- 原图URL
    result_url TEXT,                        -- 结果图URL
    file_size INTEGER,                      -- 文件大小(字节)
    status TEXT DEFAULT 'success',          -- 状态 (success/failed)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**功能说明：**
- 记录每次图片处理操作
- 可用于统计、历史记录、重新下载
- 自动清理策略（可配置保留天数）

### 1.4 用户统计表 (user_stats)
```sql
CREATE TABLE user_stats (
    user_id TEXT PRIMARY KEY,               -- 外键关联 users.id
    total_processed INTEGER DEFAULT 0,      -- 累计处理图片数
    total_storage_mb REAL DEFAULT 0,        -- 累计存储使用(MB)
    last_processed_at DATETIME,             -- 最后处理时间
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**功能说明：**
- 缓存用户统计数据，提高查询性能
- 通过触发器或定时任务更新

## 2. API 端点设计

### 2.1 用户认证

**GET /api/user**
- 获取当前登录用户信息
- 需要 Bearer Token
- 返回: `{ id, email, name, picture, exp, iat }`

**GET /api/auth/google** (重定向)
- 启动 Google OAuth 流程

**GET /api/auth/callback/google**
- OAuth 回调处理
- 生成 JWT Token
- 重定向到主页

### 2.2 用户设置

**GET /api/settings**
- 获取用户设置
- 认证: Bearer Token
- 返回: `{ display_name, language, theme, ... }`

**POST /api/settings**
- 更新用户设置
- Body: `{ display_name, language, theme }`
- 返回: `{ success: true }`

**GET /api/settings/api**
- 获取 API 设置（不返回实际 API Key）
- 返回: `{ has_api_key: boolean, default_output_format, default_size }`

**POST /api/settings/api**
- 更新 API 设置
- Body: `{ api_key, default_output_format, default_size }`
- 返回: `{ success: true }`

### 2.3 处理历史

**GET /api/history**
- 获取用户处理历史
- Query: `?limit=50`（可选，默认全部）
- 返回: `[{ id, original_url, result_url, file_size, created_at }, ...]`

**POST /api/history**
- 保存新的处理记录
- Body: `{ original_url, result_url, file_size }`
- 返回: `{ success: true, id }`

**DELETE /api/history/:id**
- 删除单条历史记录
- 需要验证记录归属
- 返回: `{ success: true }`

### 2.4 统计信息

**GET /api/stats**
- 获取用户统计数据
- 返回: `{ 
    total_processed, 
    today_processed, 
    days_active, 
    first_processed, 
    last_processed, 
    recent_activity 
  }`

### 2.5 背景去除

**POST /api/remove-bg**
- 调用 remove.bg API 处理图片
- FormData: `image_file, size`
- 返回: 图片 blob (Content-Type: image/png)

## 3. 前端页面设计

### 3.1 首页 (index.html)
- Hero 区域：产品介绍
- 上传区域：拖拽上传
- 处理中状态：加载动画
- 结果展示：原图 vs 处理后
- 特性介绍：功能亮点
- Google 登录按钮

### 3.2 个人中心 (dashboard.html)

**布局结构：**
- 顶部导航栏：Logo + 导航菜单
- 用户信息区：头像、名称、邮箱
- 统计卡片：处理数、存储使用、今日处理
- 侧边栏：菜单导航（概览、历史、设置、API）
- 主内容区：动态内容

**功能模块：**

1. **概览 (Overview)**
   - 最近处理（最多 6 张）
   - 快速操作按钮
   - 使用趋势图表（可扩展）

2. **处理历史 (History)**
   - 图片网格展示
   - 每张图片：缩略图、日期、大小
   - 操作：下载、删除
   - 无限滚动加载

3. **账户设置 (Settings)**
   - 显示名称
   - 语言选择
   - 主题切换（浅色/深色）
   - 保存按钮

4. **API 设置 (API)**
   - API Key 状态指示器
   - API Key 输入（密码类型）
   - 默认输出格式
   - 默认尺寸
   - 保存按钮

5. **退出登录**
   - 清除本地存储的 Token
   - 重定向到首页

## 4. 认证流程

### 4.1 登录流程

```
1. 用户点击 "Sign in with Google"
2. 前端重定向到 /api/auth/google
3. 后端生成 Google OAuth URL
4. 用户授权后，Google 重定向到 /api/auth/callback/google
5. 后端获取用户信息，生成 JWT Token
6. 重定向到首页，URL 中包含 ?token=xxx
7. 前端提取 Token，保存到 localStorage
8. 调用 /api/user 验证 Token
9. 显示用户信息和功能
```

### 4.2 Token 管理

- **存储位置:** localStorage (authToken)
- **Token 类型:** JWT (HS256)
- **有效期:** 7 天
- **内容:** { sub, email, name, picture, iat, exp }
- **验证:** 每次 API 请求携带 Bearer Token

### 4.3 安全措施

- Token 在客户端存储（localStorage）
- 所有 API 请求需要验证 Token
- Token 过期自动登出
- API Key 在服务器端存储（不返回给前端）
- 仅返回 API Key 是否存在的状态

## 5. 特性与优势

### 5.1 已实现的特性

✅ **完整的用户生命周期**
- 注册（首次 Google 登录）
- 登录（JWT Token）
- 个人信息展示
- 设置管理
- 退出登录

✅ **个性化体验**
- 自定义 API Key
- 默认输出格式
- 界面语言
- 主题切换

✅ **数据持久化**
- 处理历史记录
- 统计数据
- 用户设置

✅ **响应式设计**
- 支持桌面和移动端
- 自适应布局
- 触摸友好

### 5.2 技术栈

- **前端:** HTML5 + CSS3 + Vanilla JavaScript
- **后端:** Cloudflare Pages Functions (Node.js)
- **数据库:** Cloudflare D1 (SQLite)
- **认证:** Google OAuth 2.0 + JWT
- **图片处理:** remove.bg API
- **部署:** Cloudflare Pages

### 5.3 性能优化

- 静态资源部署到全球 CDN
- 图片使用 R2 存储（可配置）
- 数据库索引优化查询
- 客户端本地缓存 Token
- 懒加载历史图片

## 6. 扩展建议

### 6.1 短期可添加功能

1. **图片存储到 R2**
   ```sql
   ALTER TABLE processing_history ADD COLUMN storage_type TEXT DEFAULT 'temp';
   ```

2. **批量处理**
   - 支持一次性上传多张图片
   - 显示批量处理进度

3. **分享功能**
   - 生成分享链接
   - 设置过期时间

4. **导出数据**
   - 导出历史记录为 CSV
   - 备份用户设置

### 6.2 中期可添加功能

1. **团队协作**
   ```sql
   CREATE TABLE teams (id, name, owner_id, ...);
   CREATE TABLE team_members (team_id, user_id, role, ...);
   ```

2. **订阅计划**
   ```sql
   CREATE TABLE subscriptions (user_id, plan, expires_at, ...);
   ```

3. **Webhooks**
   - 处理完成通知
   - 集成 Slack/Discord

### 6.3 长期可添加功能

1. **AI 模型切换**
   - 支持多种背景去除模型
   - 自定义模型训练

2. **图片编辑器**
   - 手动调整边缘
   - 添加新背景

3. **API 开放平台**
   - 提供 REST API
   - API 文档和 SDK

## 7. 安全考虑

### 7.1 已实施的安全措施

- ✅ OAuth 2.0 标准认证
- ✅ JWT Token 签名验证
- ✅ API Key 服务器端存储
- ✅ SQL 注入防护（使用参数化查询）
- ✅ CORS 配置（同源策略）

### 7.2 建议添加的安全措施

- [ ] 限制 API 请求频率
- [ ] 敏感操作二次验证
- [ ] API Key 加密存储
- [ ] 定期审计日志
- [ ] HTTPS 强制执行

## 8. 监控与分析

### 8.1 可监控指标

- 日活跃用户 (DAU)
- 处理图片总数和成功率
- 平均处理时间
- 用户留存率
- 错误率

### 8.2 日志记录

- 用户登录/登出
- 图片处理请求
- API 错误
- 性能指标

---

**部署地址：** https://e424be63.imagebackgroundremover.pages.dev

**状态：** ✅ 已部署并运行正常
