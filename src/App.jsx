import React, { useEffect } from "react";
import Particles from "./components/Particles/Particles";
import Footer from "./layouts/Footer";
import Header from "./layouts/Header";
import Home from "./pages/Home";

function App() {
  // 首次載入：若有 hash 就滾動到該區塊
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // ScrollSpy
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll("section.fullpage-section[id]")
    );

    if (!sections.length) return;

    let current = "";
    const onIntersect = (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible.length) {
        const id = visible[0].target.id;
        if (id && id !== current) {
          current = id;
          const { pathname, search } = window.location;
          history.replaceState(null, "", `${pathname}${search}#${id}`);
        }
      }
    };

    const observer = new IntersectionObserver(onIntersect, {
      root: null,
      threshold: [0.55],
    });

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);

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
      <Footer />
    </div>
  );
}

export default App;
