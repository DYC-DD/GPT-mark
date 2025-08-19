import React from "react";
import "../styles/Footer.css";

const Footer = () => {
  const startYear = 2025;
  const currentYear = new Date().getFullYear();

  return (
    <div className="footer-wrapper">
      <footer className="frosted-footer">
        <p>
          © {startYear}
          {currentYear > startYear ? ` - ${currentYear}` : ""} GPT Mark. All
          rights reserved. -
          <a href="mailto:dyc.devlab@gmail.com" className="footer-email">
            DENG
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Footer;
