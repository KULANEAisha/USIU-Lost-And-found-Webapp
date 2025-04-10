// auth.js - non-module version
const API_BASE_URL = 'http://localhost:3000';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        
        try {
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => null);
                throw new Error(error?.message || "Login failed");
            }

            const result = await response.json();
            console.log("Login response:", result); // Debug log

            // Immediate storage with verification
            localStorage.setItem(result.user.is_admin ? 'adminToken' : 'token', result.token);
            localStorage.setItem('user', JSON.stringify({
                id: result.user.id,
                email: result.user.email,
                is_admin: result.user.is_admin
            }));

            // Verify storage before redirect
            const verifyToken = localStorage.getItem(result.user.is_admin ? 'adminToken' : 'token');
            const verifyUser = localStorage.getItem('user');
            
            if (!verifyToken || !verifyUser) {
                throw new Error("Storage failed - tokens not persisted");
            }

            // Instant redirect with visual feedback
            submitBtn.textContent = 'Success! Redirecting...';
            window.location.href = result.user.is_admin ? '/admin.html' : '/dashboard.html';

        } catch (error) {
            console.error("Login error:", error);
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            alert(`Login failed: ${error.message}`);
        }
    });
}

    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form values
            const user = {
                username: document.getElementById('username').value.trim(),
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('password').value
            };
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Client-side validation
            if (user.password !== confirmPassword) {
                alert("Passwords don't match!");
                return;
            }

            if (user.password.length < 6) {
                alert("Password must be at least 6 characters");
                return;
            }

            try {
                // Send signup request
                const response = await fetch(`${API_BASE_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user)
                });

                // Handle response
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Signup failed');
                }

                // Success case
                alert('Account created successfully! Please login.');
                window.location.href = 'login.html';
                
            } catch (error) {
                console.error('Signup error:', error);
                
                // User-friendly error messages
                if (error.message.includes('Email already exists')) {
                    alert('This email is already registered. Please use a different email.');
                } else if (error.message.includes('NetworkError')) {
                    alert('Cannot connect to server. Please check your internet connection.');
                } else {
                    alert(error.message || 'Signup failed. Please try again.');
                }
            }
        });
    }
});

// Utility functions
function logout() {
    // Clear all auth-related storage
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function isAuthenticated() {
    return localStorage.getItem('token') !== null || localStorage.getItem('adminToken') !== null;
}

function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Global access
window.auth = {
    logout,
    isAuthenticated,
    getCurrentUser
};