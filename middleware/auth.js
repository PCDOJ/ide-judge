// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized. Please login first.' 
    });
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }
    return res.status(403).json({ 
        success: false, 
        message: 'Forbidden. Admin access required.' 
    });
}

// Middleware to check if user is logged in (for HTML pages)
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.redirect('/login.html');
}

// Middleware to check if user is admin (for HTML pages)
function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }
    return res.redirect('/index.html');
}

module.exports = {
    isAuthenticated,
    isAdmin,
    requireAuth,
    requireAdmin
};

