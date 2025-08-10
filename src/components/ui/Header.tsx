/**
 * Header component with branding, navigation, and external links
 * Features a fixed position with backdrop blur and smooth interactions
 */
export const Header = () => {
  return (
    <header className="header">
      <div className="header__brand">
        <h1 className="header__title">ALLTP Tracker</h1>
      </div>

      <nav aria-label="External links" className="header__nav">
        <a
          aria-label="View source code on GitHub (opens in new tab)"
          className="header__link"
          href="https://github.com/kqesar/alltp-tracker"
          rel="noopener noreferrer"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            className="header__icon"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span className="sr-only">GitHub</span>
          GitHub
        </a>

        <a
          aria-label="Visit ALttP Randomizer website (opens in new tab)"
          className="header__link"
          href="https://alttpr.com/"
          rel="noopener noreferrer"
          target="_blank"
        >
          <img
            alt="Triforce icon"
            className="header__icon"
            src={`${import.meta.env.BASE_URL}zelda-triforce.ico`}
          />
          <span className="sr-only">ALttP Randomizer</span>
          ALttPR
        </a>

        <a
          aria-label="Visit original tracker inspiration (opens in new tab)"
          className="header__link"
          href="https://github.com/TestRunnerSRL/lttp-tracker"
          rel="noopener noreferrer"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            className="header__icon"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Original
        </a>
      </nav>
    </header>
  );
};
