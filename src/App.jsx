import React from 'react';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext.jsx';
import LoginScreen from './pages/LoginScreen.jsx';
import DiagnosticPage from './pages/DiagnosticPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import { BRAND_BLUE } from './config/constants.js';

const AppRouter = () => {
  const { userProfile, isAuthReady, userId } = useFirebase();

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div
            className="h-12 w-12 rounded-full border-4 border-t-transparent animate-spin"
            style={{
              borderColor: `${BRAND_BLUE} transparent transparent transparent`,
            }}
          ></div>
          <p className="mt-4 text-gray-400 font-light text-sm tracking-widest">
            LOADING ENVIRONMENT
          </p>
        </div>
      </div>
    );
  }

  if (!userId) return <LoginScreen />;
  
  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 font-light animate-pulse">
          Initializing User Profile...
        </p>
      </div>
    );
  }

  return <DashboardPage />;

};

const App = () => (
  <div className="antialiased text-gray-900 bg-gray-50 min-h-screen">
    <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Montserrat', sans-serif; }
            .animate-fade-in { animation: fadeIn 0.5s ease-out; }
            .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f1f1; border-radius: 4px; }
            .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #e0e0e0; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
    <FirebaseProvider>
      <AppRouter />
    </FirebaseProvider>
  </div>
);

export default App;