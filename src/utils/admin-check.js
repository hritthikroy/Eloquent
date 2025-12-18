// Admin check utility
// Admin users automatically get:
// - role: 'admin'
// - plan: 'enterprise' (unlimited minutes, all features)
// - subscription_status: 'active'
// Regular users get:
// - role: 'user'
// - plan: 'free' (60 minutes per month)
// - subscription_status: 'none'
function isAdminUser(user) {
  if (!user || !user.email) return false;
  
  // Check by role (if backend supports it)
  if (user.role === 'admin') return true;
  
  // Fallback: check by email
  const adminEmails = [
    'hritthikin@gmail.com'
  ];
  
  return adminEmails.includes(user.email);
}

module.exports = { isAdminUser };