import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ControlRoomPage from "@/features/control-room/ControlRoomPage";
import BattlePage from "@/features/battle-view/BattlePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/control" replace />} />
        <Route path="/control" element={<ControlRoomPage />} />
        <Route path="/battle" element={<BattlePage />} />
      </Routes>
    </BrowserRouter>
  );
}
