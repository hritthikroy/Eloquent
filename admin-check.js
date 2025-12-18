// Admin check utility
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