const FRIENDLY = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Email not confirmed': 'Please confirm your email before logging in.',
  'User already registered': 'An account with that email already exists.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
  'JWT expired': 'Your session has expired. Please log in again.',
  'Failed to fetch': 'Network error — check your connection and try again.',
  'NetworkError': 'Network error — check your connection and try again.',
};

export function friendlyError(error) {
  if (!error) return 'An unexpected error occurred.';
  const msg = error.message || String(error);
  for (const [key, friendly] of Object.entries(FRIENDLY)) {
    if (msg.includes(key)) return friendly;
  }
  return 'Something went wrong. Please try again.';
}

export function friendlyAdminError(error) {
  if (!error) return 'An unexpected error occurred.';
  const msg = error.message || String(error);
  // For admin views, show friendly prefix with technical detail for debugging
  for (const [key, friendly] of Object.entries(FRIENDLY)) {
    if (msg.includes(key)) return friendly;
  }
  return `Save failed: ${msg}`;
}
