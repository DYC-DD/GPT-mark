import React, { useEffect, useRef } from "react";
import "./Features.css";

const VIDEO_SRC =
  "https://www.youtube.com/embed/kISToM2FhVg?enablejsapi=1&rel=0";

const Features = () => {
  const iframeRef = useRef(null);
  const pauseVideo = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "*"
    );
  };

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash !== "#features") pauseVideo();
    };
    window.addEventListener("hashchange", onHashChange);
    const section = document.getElementById("features");
    let observer;
    if (section && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) pauseVideo();
        },
        { threshold: 0.25 }
      );
      observer.observe(section);
    }

    const onVisibility = () => {
      if (document.hidden) pauseVideo();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (window.location.hash && window.location.hash !== "#features") {
      pauseVideo();
    }

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="features-video-wrapper">
      <iframe
        ref={iframeRef}
        src={VIDEO_SRC}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
    </div>
  );
};

export default Features;
