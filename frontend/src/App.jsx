import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NewOrg from "./pages/NewOrg";
import MissionFraming from "./pages/stage01/MissionFraming";
import ProgramDesign from "./pages/stage01/ProgramDesign";
import StakeholderEducation from "./pages/stage01/StakeholderEducation";
import StakeholderMap from "./pages/stage01/StakeholderMap";

function RootRoute() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsAuthenticated(Boolean(session?.access_token));
      setIsChecking(false);
    }

    checkSession();
  }, []);

  if (isChecking) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <NewOrg />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stage01/mission"
        element={
          <ProtectedRoute>
            <MissionFraming />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stage01/stakeholders/intro"
        element={
          <ProtectedRoute>
            <StakeholderEducation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stage01/stakeholders"
        element={
          <ProtectedRoute>
            <StakeholderMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stage01/program-design"
        element={
          <ProtectedRoute>
            <ProgramDesign />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<RootRoute />} />
    </Routes>
  );
}

export default App;
