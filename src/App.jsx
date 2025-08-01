import React from "react";
import Particles from "./components/Particles/Particles";
import Header from "./layouts/Header";
import Home from "./pages/Home";

function App() {
  return (
    <div className="app">
      <div className="global-particles-background">
        <Particles
          particleColors={["#ffffff", "#ffffff"]}
          particleCount={300}
          particleSpread={10}
          speed={0.05}
          particleBaseSize={100}
          moveParticlesOnHover={true}
          alphaParticles={true}
          disableRotation={false}
        />
      </div>
      <Header />
      <Home />
    </div>
  );
}

export default App;
