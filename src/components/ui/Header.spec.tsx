import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";

describe("Header", () => {
  it("renders the app title", () => {
    render(<Header />);
    expect(screen.getByText("ALLTP Tracker")).toBeInTheDocument();
  });

  it("renders GitHub link with correct attributes", () => {
    render(<Header />);
    const githubLink = screen.getByRole("link", { name: /github/i });

    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/kqesar/alltp-tracker",
    );
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders ALttPR link with correct attributes", () => {
    render(<Header />);
    const alttprLink = screen.getByRole("link", {
      name: /Visit ALttP Randomizer website/i,
    });

    expect(alttprLink).toBeInTheDocument();
    expect(alttprLink).toHaveAttribute("href", "https://alttpr.com/");
    expect(alttprLink).toHaveAttribute("target", "_blank");
    expect(alttprLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Original tracker link with correct attributes", () => {
    render(<Header />);
    const originalLink = screen.getByRole("link", { name: /original/i });

    expect(originalLink).toBeInTheDocument();
    expect(originalLink).toHaveAttribute(
      "href",
      "https://github.com/TestRunnerSRL/lttp-tracker",
    );
    expect(originalLink).toHaveAttribute("target", "_blank");
    expect(originalLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders all navigation links", () => {
    render(<Header />);

    expect(
      screen.getByRole("link", { name: /View source code on GitHub/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Visit ALttP Randomizer website/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Visit original tracker inspiration/i }),
    ).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(<Header />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();

    // Check that SVG icons have aria-hidden attribute (Help, GitHub and Original links)
    const svgElements = document.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgElements).toHaveLength(3);

    // Check that IMG icon has proper alt text (ALttPR link)
    const imgElements = document.querySelectorAll('img[alt="Triforce icon"]');
    expect(imgElements).toHaveLength(1);

    // Check that each link has proper aria-label attributes
    expect(
      screen.getByLabelText("View source code on GitHub (opens in new tab)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Visit ALttP Randomizer website (opens in new tab)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Visit original tracker inspiration (opens in new tab)",
      ),
    ).toBeInTheDocument();
  });
});
