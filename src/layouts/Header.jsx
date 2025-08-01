import React from "react";
import chromeIcon from "../assets/chrome.svg";
import githubIcon from "../assets/github.svg";
import "../styles/Header.css";

const Header = () => {
  return (
    <div className="header-wrapper">
      <header className="frosted-header">
        <div className="header-inner">
          <a href="#home" className="logo">
            GPT Mark
          </a>
          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#q&a">Q&A</a>
          </nav>
        </div>
      </header>

      <div className="floating-icon-buttons">
        <a
          href="https://github.com/DYC-DD/GPT-mark"
          target="_blank"
          rel="noopener noreferrer"
          className="icon-button"
          aria-label="GitHub"
        >
          <img src={githubIcon} alt="GitHub" />
        </a>
        <a
          href="https://chromewebstore.google.com/detail/bhkpgjjgjgdgpbjdfhkljhcefohegooc?utm_source=item-share-cb"
          target="_blank"
          rel="noopener noreferrer"
          className="icon-button"
          aria-label="Chrome Web Store"
        >
          <img src={chromeIcon} alt="Chrome Web Store" />
        </a>
      </div>
    </div>
  );
};

export default Header;
