const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const examRoutes = require('./routes/exam');
const submissionRoutes = require('./routes/submission');
const notificationRoutes = require('./routes/notification');
const workspaceRoutes = require('./routes/workspace');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 2308;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve IDE Judge0 static files
app.use('/ide', express.static(path.join(__dirname, 'ide-judge0')));

// Proxy Judge0 API requests
const judge0ApiUrl = process.env.JUDGE0_API_URL || 'http://localhost:2358';
app.use('/judge0-api', createProxyMiddleware({
    target: judge0ApiUrl,
    changeOrigin: true,
    pathRewrite: {
        '^/judge0-api': ''
    },
    onError: (err, req, res) => {
        console.error('Judge0 API proxy error:', err);
        res.status(500).json({
            success: false,
            message: 'Judge0 API is not available'
        });
    }
}));

// Proxy Code-Server requests
const codeServerUrl = process.env.CODE_SERVER_URL || 'http://code-server:8080';
const codeServerProxy = createProxyMiddleware({
    target: codeServerUrl,
    changeOrigin: true,
    ws: true, // Enable WebSocket support for terminal
    pathRewrite: {
        '^/code-server': ''
    },
    logLevel: 'debug', // Enable detailed logging for debugging
    onProxyReq: (proxyReq, req, res) => {
        // Forward the original host header to code-server for origin check
        // This is required for code-server's security origin validation
        if (req.headers.host) {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
        }

        // Log HTTP proxy requests with full details
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
        const targetUrl = `${codeServerUrl}${proxyReq.path}`;
        console.log(`[Code-Server Proxy HTTP] ${req.method} ${req.url} -> ${targetUrl}`);
        if (queryString) {
            console.log(`[Code-Server Proxy HTTP] Query params: ${queryString}`);
        }
    },
    onProxyReqWs: (proxyReq, req, socket, options, head) => {
        // Forward the original host header to code-server for WebSocket origin check
        // This is critical for WebSocket connections to work through proxy
        if (req.headers.host) {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
        }

        // Log WebSocket upgrade requests with full details
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
        const targetUrl = `${codeServerUrl}${req.url.replace(/^\/code-server/, '')}`;
        console.log(`[Code-Server Proxy WS] UPGRADE ${req.url} -> ${targetUrl}`);
        if (queryString) {
            console.log(`[Code-Server Proxy WS] Query params: ${queryString}`);
        }
        console.log(`[Code-Server Proxy WS] Headers:`, {
            host: req.headers.host,
            origin: req.headers.origin,
            upgrade: req.headers.upgrade,
            connection: req.headers.connection
        });
    },
    onError: (err, req, res) => {
        console.error('[Code-Server Proxy Error]', {
            error: err.message,
            url: req.url,
            method: req.method,
            stack: err.stack
        });

        // Handle WebSocket errors differently
        if (res.socket && res.socket.writable) {
            res.socket.end();
        } else if (res.writeHead && !res.headersSent) {
            // Only call status() if it's an HTTP response (not WebSocket)
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Code-Server is not available',
                error: err.message
            }));
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        // Log successful proxy responses
        console.log(`[Code-Server Proxy Response] ${req.method} ${req.url} - Status: ${proxyRes.statusCode}`);
    }
});

app.use('/code-server', codeServerProxy);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', examRoutes);
app.use('/api/submission', submissionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/workspace', workspaceRoutes);

// Protected routes for HTML pages
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin/*', requireAdmin, (req, res, next) => {
    next();
});

// Root redirect
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        res.redirect('/index.html');
    } else {
        res.redirect('/login.html');
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route not found' 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// Workspace cleanup scheduler (chạy mỗi ngày lúc 2h sáng)
const cron = require('node-cron');
const workspaceManager = require('./utils/workspace-manager');

cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Running workspace cleanup...');
    try {
        await workspaceManager.cleanupExpiredWorkspaces();
        console.log('[Scheduler] Workspace cleanup completed');
    } catch (error) {
        console.error('[Scheduler] Workspace cleanup error:', error);
    }
});

console.log('✓ Workspace cleanup scheduler started (runs daily at 2:00 AM)');

// Start server with WebSocket support
const http = require('http');
const server = http.createServer(app);

// Setup WebSocket upgrade for code-server proxy
server.on('upgrade', (req, socket, head) => {
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    const pathname = req.url.split('?')[0];

    console.log(`[WebSocket Upgrade] Incoming request:`, {
        url: req.url,
        pathname: pathname,
        queryString: queryString,
        headers: {
            host: req.headers.host,
            origin: req.headers.origin,
            upgrade: req.headers.upgrade,
            connection: req.headers.connection,
            'sec-websocket-key': req.headers['sec-websocket-key'],
            'sec-websocket-version': req.headers['sec-websocket-version']
        }
    });

    if (pathname.startsWith('/code-server')) {
        try {
            console.log(`[WebSocket Upgrade] Forwarding to code-server proxy...`);
            // Let the proxy handle the upgrade
            codeServerProxy.upgrade(req, socket, head);
            console.log(`[WebSocket Upgrade] Successfully forwarded to proxy`);
        } catch (error) {
            console.error(`[WebSocket Upgrade] Error forwarding to proxy:`, {
                error: error.message,
                stack: error.stack,
                url: req.url
            });
            socket.destroy();
        }
    } else {
        console.log(`[WebSocket Upgrade] Rejected - path does not start with /code-server:`, pathname);
        socket.destroy();
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Server is running on port ${PORT}`);
    console.log(`✓ Access the application at http://localhost:${PORT}`);
});

