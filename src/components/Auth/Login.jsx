import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const Login = () => {
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('student');
  const [crType, setCrType] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const token = query.get('token');
    if (token) {
      setIsLoading(true);
      handleCustomTokenLogin(token, true); // Google Auth
    }
  }, [location]);

  const handleCustomTokenLogin = async (customToken, isGoogleAuth = false) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const userCredential = await signInWithCustomToken(auth, customToken, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const idToken = await userCredential.user.getIdToken();
      localStorage.setItem('token', idToken);
      localStorage.setItem('firebaseAuthenticated', 'true');

      const response = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${idToken}` },
        timeout: 15000,
      });
      const data = response.data;

      localStorage.setItem('role', data.role.toUpperCase());
      localStorage.setItem('user_id', data.id.toString());
      localStorage.setItem('classcode', data.class_code || '');
      localStorage.setItem('cr_type', data.cr_type || '');
      localStorage.setItem('cr_elective_id', data.cr_elective_id || '');

      navigateToDashboard(data, isGoogleAuth);
    } catch (e) {
      console.error('Custom token login error:', e);
      setError(
        e.code === 'auth/network-request-failed' || e.name === 'AbortError'
          ? 'Network error. Please check your connection.'
          : e.code === 'auth/invalid-custom-token'
          ? 'Invalid token'
          : 'Authentication failed'
      );
      localStorage.clear();
      setIsLoading(false);
    }
  };

  const navigateToDashboard = (data, isGoogleAuth) => {
    if (
      isGoogleAuth &&
      (!data.username || !data.roll_no || !data.college || !data.branch || !data.semester)
    ) {
      navigate('/complete-profile');
    } else if (data.is_cr) {
      navigate(data.cr_type === 'regular' ? '/regular-cr-dashboard' : '/elective-cr-dashboard');
    } else {
      navigate('/student-dashboard');
    }
    setIsLoading(false);
  };

  const handleLogin = async (e) => {
  e.preventDefault();
  if (isSubmitting) return;
  setIsSubmitting(true);
  setError(null);

  try {
    const attemptRequest = async (attempt = 1, maxAttempts = 2) => {
      try {
        if (!email || !password) throw new Error('Email and password are required');

        console.log('Sending login request:', { email, attempt });

        // 1️⃣ Login to your backend
        const response = await axios.post(`${API_URL}/api/auth/login`, { email, password }, { timeout: 30000 });
        const { token, role, user_id, classcode, cr_type, cr_elective_id, username } = response.data;

        if (!user_id) throw new Error('Login failed: user ID missing from backend');

        // 2️⃣ Request Firebase custom token
        console.log('Requesting Firebase custom token for uid:', user_id);
        const customTokenResponse = await axios.post(`${API_URL}/api/auth/custom-token`, { uid: user_id });
        const customToken = customTokenResponse.data.token;

        if (!customToken) throw new Error('Failed to get Firebase custom token');

        // 3️⃣ Sign in to Firebase
        await signInWithCustomToken(auth, customToken);
        console.log('Firebase login successful');

        // 4️⃣ Save user info safely
        localStorage.setItem('role', role ? role.toUpperCase() : '');
        localStorage.setItem('user_id', user_id?.toString() || '');
        localStorage.setItem('classcode', classcode || '');
        localStorage.setItem('cr_type', cr_type || '');
        localStorage.setItem('cr_elective_id', cr_elective_id || '');
        localStorage.setItem('user_name', username || email || 'Unknown');

      } catch (error) {
        console.error('Login error:', error);

        // Retry logic for timeouts
        if (error.code === 'ECONNABORTED' && attempt < maxAttempts) {
          console.warn(`Login attempt ${attempt} timed out, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptRequest(attempt + 1, maxAttempts);
        }

        let errorMsg = 'Login failed';
        if (error.response) errorMsg = error.response.data.error || 'Invalid credentials';
        else if (error.message) errorMsg = error.message;

        setError(errorMsg);
        setIsLoading(false);
      }
    };

    await attemptRequest();
  } catch (err) {
    console.error('Unexpected login error:', err);
    setError(err?.response?.data?.message || 'Login failed. Try again later.');
  } finally {
    setIsSubmitting(false);
  }
};


  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-600 mb-4 text-center">AttendanceTracker</h1>
        {error && <p className="text-red-700 bg-red-100 p-2 mb-4 rounded">{error}</p>}
        {isLoading && <p className="text-blue-600 mb-4 text-center">Logging in...</p>}
        <div className="flex justify-center mb-4">
          <button
            className={`px-4 py-2 rounded-l-lg ${
              userType === 'student' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200'
            }`}
            onClick={() => {
              setUserType('student');
              setCrType('');
            }}
          >
            Student
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${
              userType === 'cr' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200'
            }`}
            onClick={() => {
              setUserType('cr'); // Fix case to lowercase
              setCrType('');
            }}
          >
            Class Rep
          </button>
        </div>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 mb-1">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="lifeofmanu17@gmail.com"
              required
            />
          </div>
          <div className="mb-4 relative">
            <label htmlFor="password" className="block text-gray-700 mb-1">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-2 top-9 text-gray-600"
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
          {userType === 'cr' && (
            <div className="mb-4">
              <label htmlFor="crType" className="block text-gray-700 mb-1">CR Type</label>
              <select
                id="crType"
                value={crType}
                onChange={(e) => setCrType(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              >
                <option value="">Select CR Type</option>
                <option value="regular">Regular CR</option>
                <option value="elective">Elective CR</option>
              </select>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="mt-4">
          <button
            onClick={() => (window.location.href = `${API_URL}/auth/google`)}
            className="w-full flex items-center justify-center p-2 border rounded hover:bg-gray-100"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.20-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.04.69-2.37 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C4 20.36 7.9 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.9 1 4 3.64 2.18 7.07l2.66 2.84c.87-2.60 3.30-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>
        <div className="mt-4 text-center">
          <a href="/forgot-password" className="text-blue-600 hover:underline">
            Forgot Password?
          </a>
          <p className="mt-2">
            Don’t have an account?{' '}
            <a
              href={userType === 'student' ? '/register' : '/cr-register'}
              className="text-blue-600 hover:underline"
            >
              Register Now
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;