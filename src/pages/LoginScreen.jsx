import React, { useState } from 'react';
import AdminPage from '../components/AdminPage';
import { useFirebase } from '../context/FirebaseContext';
import { BRAND_BLUE } from '../config/constants';

const LoginScreen = () => {
  const { loginWithEmail, signupWithEmail } = useFirebase();
  const [mode, setMode] = useState('menu');

  const [firstName, setFirstName] = useState(''); // ✅ new
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAuth = async (isSignup) => {
    setIsLoading(true);
    setError(null);

    try {
      // ✅ lightweight validation
      if (!email.trim()) throw new Error('Please enter your email.');
      if (!password) throw new Error('Please enter your password.');
      if (isSignup && !firstName.trim())
        throw new Error('Please enter your first name.');

      if (isSignup) {
        await signupWithEmail(email.trim(), password, firstName.trim());
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'admin') return <AdminPage setView={setMode} />;

  if (mode === 'menu') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-10 text-center" style={{ backgroundColor: BRAND_BLUE }}>
            <div className="inline-block p-3 rounded-full bg-white/20 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-light text-white tracking-wide font-['Montserrat']">
              SAT<span className="font-semibold">PREP</span>
            </h1>
            <p className="text-white/80 mt-2 text-sm font-light">
              Targeted Practice for Mastery.
            </p>
          </div>

          <div className="p-8 space-y-4 bg-white">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className="w-full py-4 px-6 bg-white border border-[#1e82ff] text-[#1e82ff] font-medium rounded-xl hover:bg-[#1e82ff]/5 transition-all flex items-center justify-center"
            >
              Log In
            </button>

            <button
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className="w-full py-4 px-6 bg-[#1e82ff] text-white font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center"
            >
              Sign Up
            </button>

            <div className="text-center pt-2">
              <button
                onClick={() => setMode('admin')}
                className="text-xs text-gray-300 hover:text-gray-500"
              >
                Admin Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSignup = mode === 'signup';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-8 bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {isSignup && (
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1e82ff]"
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1e82ff]"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1e82ff]"
            />

            <button
              onClick={() => handleAuth(isSignup)}
              disabled={isLoading}
              className="w-full py-4 bg-[#1e82ff] text-white font-medium rounded-xl hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-60"
            >
              {isLoading ? 'Processing...' : isSignup ? 'Sign Up' : 'Log In'}
            </button>

            <button
              onClick={() => {
                setMode('menu');
                setError(null);
                setIsLoading(false);
              }}
              className="w-full text-gray-400 text-sm hover:text-gray-600"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
