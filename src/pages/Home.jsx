import React, { useState } from "react";
import gptImage from "../assets/GPT-pin-Photoroom.png";
import starIcon from "../assets/star-fill.svg";
import texture from "../assets/texture.avif";
import GithubStars from "../components/GithubStars/GithubStars";
import Particles from "../components/Particles/Particles";
import ProfileCard from "../components/ProfileCard/ProfileCard";
import "../styles/Home.css";

function Home() {
  const [githubInfo, setGithubInfo] = useState({
    stars: null,
    avatarUrl: null,
  });

  return (
    <div className="home-container">
      <div className="particles-background">
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

      <div className="home-content">
        <ProfileCard
          name="ChatGPT Mark"
          title="Chrome extension"
          handle="DYC-DD"
          projectUrl="https://github.com/DYC-DD/GPT-mark"
          profileUrl="https://github.com/DYC-DD"
          iconUrl={texture}
          status={
            githubInfo.stars ? (
              <span className="pc-status-stars">
                <img src={starIcon} alt="Star" />
                {githubInfo.stars} Stars
              </span>
            ) : (
              "Loading..."
            )
          }
          contactText="Download"
          avatarUrl={gptImage}
          miniAvatarUrl={githubInfo.avatarUrl || gptImage}
          showUserInfo={true}
          enableTilt={true}
          onContactClick={() => console.log("Contact clicked")}
        />

        <GithubStars user="DYC-DD" repo="GPT-mark" onFetch={setGithubInfo} />
      </div>
    </div>
  );
}

export default Home;
