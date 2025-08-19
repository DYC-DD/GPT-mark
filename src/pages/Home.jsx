import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import gptImage from "../assets/GPT-pin-Photoroom.png";
import starIcon from "../assets/star-fill.svg";
import texture from "../assets/texture.avif";
import AnimatedList from "../components/AnimatedList/AnimatedList";
import Features from "../components/Features/Features";
import GithubStars from "../components/GithubStars/GithubStars";
import ProfileCard from "../components/ProfileCard/ProfileCard";
import "../styles/Home.css";

function Home() {
  const { t } = useTranslation();
  const qaList = t("qaList", { returnObjects: true });
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
        <div className="section-inner features-section">
          <h1>Features</h1>
          <Features />
          <p>This is the instruction and tutorial for GPT-mark.</p>
        </div>
      </section>

      <section id="faq" className="section fullpage-section">
        <div className="section-inner">
          <h1>FAQs</h1>
          <AnimatedList
            items={qaList}
            onItemSelect={(item, idx) => console.log(item, idx)}
            showGradients={true}
            enableArrowNavigation={true}
            displayScrollbar={false}
          />
        </div>
      </section>
    </main>
  );
}

export default Home;
