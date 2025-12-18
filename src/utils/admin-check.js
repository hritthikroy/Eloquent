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
  if (!user) return false;
  
  // Check by role (primary method - backend should set this)
  if (user.role === 'admin' || user.role === 'administrator') {
    return true;
  }
  
  // Check by email (fallback method)
  if (user.email) {
    const adminEmails = getAdminEmails();
    return adminEmails.includes(user.email.toLowerCase());
  }
  
  return false;
}

function getAdminEmails() {
  // Environment variable for admin emails (comma-separated)
  const envAdmins = process.env.ADMIN_EMAILS;
  if (envAdmins) {
    return envAdmins.split(',').map(email => email.trim().toLowerCase());
  }
  
  // Fallback to hardcoded list
  return [
    'hritthikin@gmail.com'
  ].map(email => email.toLowerCase());
}

function addAdminEmail(email) {
  // This would be used by admin management interface
  // For now, just log the request
  console.log(`Admin email addition requested: ${email}`);
  // In production, this should update a database or config file
}

function removeAdminEmail(email) {
  // This would be used by admin management interface
  // For now, just log the request
  console.log(`Admin email removal requested: ${email}`);
  // In production, this should update a database or config file
}

module.exports = { 
  isAdminUser, 
  getAdminEmails, 
  addAdminEmail, 
  removeAdminEmail 
};