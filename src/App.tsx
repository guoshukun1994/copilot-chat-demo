import React from "react";
import ChatView from "./chat/ChatView";
import "./App.css";

const App: React.FC = () => (
  <div
    style={{
      width: "100vw",
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#f5f5f5",
    }}
  >
    <div
      style={{
        width: 540,
        height: "80vh",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <ChatView />
    </div>
  </div>
);

export default App;
