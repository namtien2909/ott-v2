import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { routes } from "./routes";

const HomePage = lazy(() => import("../pages/HomePage"));
const QueuePage = lazy(() => import("../pages/QueuePage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const RegisterPage = lazy(() => import("../pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const GameRoomPage = lazy(() => import("../pages/GameRoomPage"));
const HistoryPage = lazy(() => import("../pages/HistoryPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const FriendsPage = lazy(() => import("../pages/FriendsPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const GuestSetupPage = lazy(() => import("../pages/GuestSetupPage"));
const LocalGamePage = lazy(() => import("../pages/LocalGamePage"));
const SpectatorPage = lazy(() => import("../pages/SpectatorPage"));

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={routes.home} element={<HomePage />} />
        <Route path={routes.login} element={<LoginPage />} />
        <Route path={routes.canonicalLogin} element={<LoginPage />} />
        <Route path={routes.register} element={<RegisterPage />} />
        <Route path={routes.canonicalRegister} element={<RegisterPage />} />
        <Route path={routes.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={routes.canonicalForgotPassword} element={<ForgotPasswordPage />} />
        <Route path={routes.canonicalHome} element={<HomePage />} />
        <Route path={routes.queue} element={<QueuePage />} />
        <Route path={routes.gameRoom} element={<GameRoomPage />} />
        <Route path={routes.canonicalGameRoom} element={<GameRoomPage />} />
        <Route path={routes.canonicalGame} element={<GameRoomPage />} />
        <Route path={routes.history} element={<HistoryPage />} />
        <Route path={routes.canonicalHistory} element={<HistoryPage />} />
        <Route path={routes.matchHistory} element={<HistoryPage />} />
        <Route path={routes.profile} element={<ProfilePage />} />
        <Route path={routes.canonicalProfile} element={<ProfilePage />} />
        <Route path={routes.friends} element={<FriendsPage />} />
        <Route path={routes.canonicalFriends} element={<FriendsPage />} />
        <Route path={routes.settings} element={<SettingsPage />} />
        <Route path={routes.canonicalSettings} element={<SettingsPage />} />
        <Route path={routes.guest} element={<GuestSetupPage />} />
        <Route path={routes.guestPlay} element={<Navigate to={routes.offline} replace />} />
        <Route path={routes.ai} element={<LocalGamePage mode="AI" />} />
        <Route path={routes.offline} element={<LocalGamePage mode="OFFLINE" />} />
        <Route path={routes.spectator} element={<SpectatorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
