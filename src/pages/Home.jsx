import React, { useState } from "react";
import gptImage from "../assets/GPT-pin-Photoroom.png";
import starIcon from "../assets/star-fill.svg";
import texture from "../assets/texture.avif";
import AnimatedList from "../components/AnimatedList/AnimatedList";
import Features from "../components/Features/Features";
import GithubStars from "../components/GithubStars/GithubStars";
import ProfileCard from "../components/ProfileCard/ProfileCard";
import "../styles/Home.css";

function Home() {
  const qaList = [
    {
      title: "什麼是 GPT-mark？",
      content:
        "GPT-mark 是一款 Chrome 擴充工具，專為 ChatGPT 網頁設計，提供「訊息書籤」與「側邊欄快速導航」功能，讓使用者能快速標記並回顧重要內容。",
    },
    {
      title: "書籤如何新增？",
      content:
        "在 ChatGPT 訊息下方複製按鈕左側會出現一個書籤圖示，點擊即可加入或移除書籤。",
    },
    {
      title: "書籤要如何管理？",
      content:
        "開啟右側的側邊欄，即可查看已加入的書籤，支援依聊天順序或加入順序排序，並可依 `#Hashtag` 進行篩選。",
    },
    {
      title: "如何開啟側邊欄？",
      content:
        "• 點擊擴充工具圖示。\n• 在 ChatGPT 頁面右鍵選單點擊「Open GPT-mark」。",
    },
    {
      title: "如何使用 Hashtag？",
      content:
        "在側邊欄的書籤卡片上，點擊「`#`」按鈕即可新增標籤；已存在的標籤會顯示在書籤下方，也可刪除。",
    },
    {
      title: "書籤能否跨裝置同步？",
      content:
        "可以。本工具透過 `chrome.storage.local` 與 `chrome.storage.sync` 雙儲存，確保書籤能在不同裝置間同步。",
    },
    {
      title: "書籤會不會被刪掉？",
      content:
        "若刪除書籤，會先標記為「墓碑」狀態，30 天後才會自動清除，避免誤刪後無法還原。",
    },
    {
      title: "匯出書籤的格式是什麼？",
      content:
        "匯出為 JSON 檔案\n• `downloadInfo`：下載時間、總聊天室數\n• `chats`：每個聊天室的 `chatId`、`url`、`bookmarkCount`、`bookmarks`\n（包含 `id`、`role`、`content`、`hashtags`、`updatedAt`）",
    },
    {
      title: "雙擊 Enter 功能是什麼？",
      content:
        "在「編輯訊息」時：\n• 單擊 `Enter` → 換行\n• 快速雙擊 `Enter` → 送出訊息\n• `Shift + Enter` → 永遠換行",
    },
    {
      title: "側邊欄無法在其他網站開啟是正常的嗎？",
      content:
        "是的。側邊欄只允許在 chat.openai.com 與 chatgpt.com 網頁使用，避免干擾其他網站。",
    },
  ];
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
