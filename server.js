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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', examRoutes);
app.use('/api/submission', submissionRoutes);

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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Server is running on port ${PORT}`);
    console.log(`✓ Access the application at http://localhost:${PORT}`);
});

