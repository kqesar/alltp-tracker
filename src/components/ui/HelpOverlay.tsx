import { useState } from "react";
import { helpContent } from "@/data/tooltips";

type HelpOverlayProps = {
  /** Whether the help overlay is visible */
  isVisible: boolean;
  /** Callback to close the help overlay */
  onClose: () => void;
};

/**
 * HelpOverlay component that displays comprehensive help information
 * Includes keyboard shortcuts, gameplay tips, and general guidance
 */
export const HelpOverlay = ({ isVisible, onClose }: HelpOverlayProps) => {
  const [activeTab, setActiveTab] = useState<"shortcuts" | "tips">("shortcuts");

  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      aria-labelledby="help-title"
      aria-modal="true"
      className="help-overlay"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      tabIndex={-1}
    >
      <div className="help-overlay__content">
        <header className="help-overlay__header">
          <h2 className="help-overlay__title" id="help-title">
            ALttP Randomizer Tracker Help
          </h2>
          <button
            aria-label="Close help"
            className="help-overlay__close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <nav className="help-overlay__tabs">
          <button
            className={`help-overlay__tab ${activeTab === "shortcuts" ? "help-overlay__tab--active" : ""}`}
            onClick={() => setActiveTab("shortcuts")}
            type="button"
          >
            Keyboard Shortcuts
          </button>
          <button
            className={`help-overlay__tab ${activeTab === "tips" ? "help-overlay__tab--active" : ""}`}
            onClick={() => setActiveTab("tips")}
            type="button"
          >
            Gameplay Tips
          </button>
        </nav>

        <main className="help-overlay__body">
          {activeTab === "shortcuts" && (
            <div className="help-section">
              <h3 className="help-section__title">
                {helpContent.keyboardShortcuts.title}
              </h3>
              {helpContent.keyboardShortcuts.sections.map((section) => (
                <div className="help-subsection" key={section.title}>
                  <h4 className="help-subsection__title">{section.title}</h4>
                  <div className="help-shortcuts">
                    {section.shortcuts.map((shortcut) => (
                      <div className="help-shortcut" key={shortcut.description}>
                        <div className="help-shortcut__keys">
                          {shortcut.keys.map((key) => (
                            <kbd className="help-shortcut__key" key={key}>
                              {key}
                            </kbd>
                          ))}
                        </div>
                        <span className="help-shortcut__description">
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "tips" && (
            <div className="help-section">
              <h3 className="help-section__title">
                {helpContent.gameplayTips.title}
              </h3>
              {helpContent.gameplayTips.sections.map((section) => (
                <div className="help-subsection" key={section.title}>
                  <h4 className="help-subsection__title">{section.title}</h4>
                  <ul className="help-tips">
                    {section.tips.map((tip) => (
                      <li className="help-tip" key={tip}>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </main>

        <footer className="help-overlay__footer">
          <p className="help-overlay__info">
            This tracker helps you keep track of items and progress in The
            Legend of Zelda: A Link to the Past Randomizer. Hover over items for
            detailed tooltips with requirements and tips.
          </p>
          <button
            className="help-overlay__close-button"
            onClick={onClose}
            type="button"
          >
            Close Help
          </button>
        </footer>
      </div>
    </div>
  );
};
