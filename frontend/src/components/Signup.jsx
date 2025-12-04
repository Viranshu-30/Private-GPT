import React, { useState, useEffect } from 'react';
import { api } from '../api';

const UserPlusIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="8.5" cy="7" r="4"></circle>
    <line x1="20" y1="8" x2="20" y2="14"></line>
    <line x1="23" y1="11" x2="17" y2="11"></line>
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
  </svg>
);

const MapPinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

/**
 * Signup Component - Updated with purple gradient theme
 */
export default function Signup({ onSignedUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [allowLocation, setAllowLocation] = useState(true);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Request location permission
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocode using OpenStreetMap Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: { 'User-Agent': 'MemoryChat/1.0' }
            }
          );
          const data = await response.json();
          
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || 'Unknown';
          const state = addr.state || '';
          const country = addr.country || '';
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          
          setLocation({
            city,
            state,
            country,
            latitude: String(latitude),
            longitude: String(longitude),
            timezone,
            formatted: `${city}${state ? ', ' + state : ''}${country ? ', ' + country : ''}`,
          });
          setLocationError('');
        } catch (err) {
          console.error('Geocoding error:', err);
          setLocationError('Could not determine location details');
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location access denied. You can set it later in settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information unavailable.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out.');
            break;
          default:
            setLocationError('An error occurred getting your location.');
        }
      }
    );
  };

  // Auto-request location when checkbox is checked
  useEffect(() => {
    if (allowLocation && !location && !locationError) {
      requestLocation();
    }
  }, [allowLocation]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        email,
        password,
      };
      
      // Add optional fields
      if (name) payload.name = name;
      if (occupation) payload.occupation = occupation;
      
      // Add location if detected
      if (location) {
        payload.location_city = location.city;
        payload.location_state = location.state;
        payload.location_country = location.country;
        payload.location_latitude = location.latitude;
        payload.location_longitude = location.longitude;
        payload.location_timezone = location.timezone;
        payload.location_formatted = location.formatted;
      }

      await api.post('/auth/signup', payload);
      setSuccess(true);
      setTimeout(() => onSignedUp(), 1500);
    } catch (e) {
      setError(e.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Background Glow Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--gradient-start)] rounded-full filter blur-[128px] opacity-20"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--gradient-mid)] rounded-full filter blur-[128px] opacity-15"></div>
      </div>

      <div className="relative max-w-md w-full">
        {/* Main Card */}
        <div className="glass-strong rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center border-b border-[var(--border-subtle)]">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-mid)] flex items-center justify-center mb-6 shadow-lg glow">
              <UserPlusIcon />
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-2">
              Create Account
            </h1>
            <p className="text-[var(--text-muted)]">
              Get started with PrivateGPT
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="p-8 space-y-5">
            {/* Name Input (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Name <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <UserIcon />
                </div>
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-3 rounded-xl input-field text-sm"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <MailIcon />
                </div>
                <input
                  type="email"
                  className="w-full pl-12 pr-4 py-3 rounded-xl input-field text-sm"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <KeyIcon />
                </div>
                <input
                  type="password"
                  className="w-full pl-12 pr-4 py-3 rounded-xl input-field text-sm"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Occupation Input (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Occupation <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <BriefcaseIcon />
                </div>
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-3 rounded-xl input-field text-sm"
                  placeholder="e.g., ML Engineer, Student"
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Location Permission */}
            <div className="p-4 rounded-xl bg-[var(--surface-light)] border border-[var(--border-subtle)]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowLocation}
                  onChange={(e) => setAllowLocation(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[var(--gradient-mid)]"
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <MapPinIcon />
                    Allow location access
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Used for weather, time, and local recommendations
                  </p>
                </div>
              </label>

              {allowLocation && location && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="flex items-start gap-2 text-sm">
                    <div className="text-[var(--accent-success)] mt-0.5">
                      <CheckIcon />
                    </div>
                    <div className="flex-1">
                      <p className="text-[var(--accent-success)] font-medium">Location detected</p>
                      <p className="text-[var(--text-muted)] text-xs mt-1">{location.formatted}</p>
                      <p className="text-[var(--text-muted)] text-xs">Timezone: {location.timezone}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {allowLocation && locationError && !location && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <p className="text-sm text-[var(--accent-warning)]">⚠️ {locationError}</p>
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="text-[var(--gradient-mid)] hover:text-[var(--gradient-end)] text-xs mt-2 underline"
                    disabled={loading}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--gradient-start)]/10 to-[var(--gradient-mid)]/5 border border-[var(--border-subtle)]">
              <p className="text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--gradient-mid)]">💡 No API Keys Required!</strong>
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                You can add API keys after signing up. Start with just your email and password.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-red-900/20 border border-red-700/50">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-4 rounded-xl bg-green-900/20 border border-green-700/50">
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <CheckIcon />
                  Account created successfully! Redirecting...
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full btn-primary py-4 rounded-xl font-semibold text-base"
              disabled={loading || success}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75"></path>
                  </svg>
                  Creating Account...
                </span>
              ) : success ? (
                'Success! ✓'
              ) : (
                'Create Account'
              )}
            </button>

            {/* Sign In Link */}
            <div className="text-center text-sm text-[var(--text-muted)]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSignedUp}
                className="text-[var(--gradient-mid)] hover:text-[var(--gradient-end)] font-medium transition-colors"
                disabled={loading}
              >
                Sign in
              </button>
            </div>
          </form>
        </div>

        {/* Powered by MemMachine Badge */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--gradient-mid)]">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v4"></path>
            <path d="M12 19v4"></path>
            <path d="M4.22 4.22l2.83 2.83"></path>
            <path d="M16.95 16.95l2.83 2.83"></path>
            <path d="M1 12h4"></path>
            <path d="M19 12h4"></path>
            <path d="M4.22 19.78l2.83-2.83"></path>
            <path d="M16.95 7.05l2.83-2.83"></path>
          </svg>
          <span className="text-xs text-[var(--text-muted)]">
            Powered by <span className="text-[var(--gradient-mid)] font-medium">MemMachine</span>
          </span>
        </div>
      </div>
    </div>
  );
}