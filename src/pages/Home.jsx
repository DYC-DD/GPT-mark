import React, { useState } from "react";
import gptImage from "../assets/GPT-pin-Photoroom.png";
import starIcon from "../assets/star-fill.svg";
import texture from "../assets/texture.avif";
import GithubStars from "../components/GithubStars/GithubStars";
import ProfileCard from "../components/ProfileCard/ProfileCard";
import "../styles/Home.css";

function Home() {
  const [githubInfo, setGithubInfo] = useState({
    stars: null,
    avatarUrl: null,
  });

  return (
    <main className="scroll-container">
      <section id="home" className="section fullpage-section">
        <div className="home-content">
          <ProfileCard
            name="ChatGPT Mark"
            title="Chrome extension"
            handle="DYC-DD"
            projectUrl="https://chromewebstore.google.com/detail/bhkpgjjgjgdgpbjdfhkljhcefohegooc?utm_source=item-share-cb"
            profileUrl="https://github.com/DYC-DD"
            iconUrl={texture}
            status={
              githubInfo.stars ? (
                <a
                  href="https://github.com/DYC-DD/GPT-mark"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pc-status-stars"
                  style={{ textDecoration: "none" }}
                >
                  <img src={starIcon} alt="Star" />
                  {githubInfo.stars} Stars
                </a>
              ) : (
                "Loading..."
              )
            }
            avatarUrl={gptImage}
            miniAvatarUrl={githubInfo.avatarUrl || gptImage}
            showUserInfo={true}
            enableTilt={true}
            contactText="Download"
            onContactClick={() =>
              window.open(
                "https://chromewebstore.google.com/detail/bhkpgjjgjgdgpbjdfhkljhcefohegooc?utm_source=item-share-cb",
                "_blank"
              )
            }
          />

          <GithubStars user="DYC-DD" repo="GPT-mark" onFetch={setGithubInfo} />
        </div>
      </section>

      <section id="features" className="section fullpage-section">
        <div className="section-inner">
          <h1>Features</h1>
          <p>Features</p>
        </div>
      </section>

      <section id="q&a" className="section fullpage-section">
        <div className="section-inner">
          <h1>Q&A</h1>
          <p>QA</p>
        </div>
      </section>
    </main>
  );
}

export default Home;
