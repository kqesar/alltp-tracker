import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";

const LINKS = [
  {
    href: "https://github.com/kqesar/alltp-tracker",
    id: "link-github",
    visible: "GitHub",
  },
  { href: "https://alttpr.com/", id: "link-alttpr", visible: "ALttPR" },
  {
    href: "https://github.com/TestRunnerSRL/lttp-tracker",
    id: "link-original",
    visible: "Original",
  },
] as const;

describe("Header", () => {
  it("renders the app title as the page heading", () => {
    render(<Header />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Rando Atlas" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["alttpr", "A Link to the Past"],
    ["sm", "Super Metroid"],
    ["smz3", "SMZ3"],
  ] as const)("names the game tracked: %s", (game, name) => {
    render(<Header game={game} />);

    expect(screen.getByTestId("header-game")).toHaveTextContent(name);
  });

  it.each(LINKS)("opens $visible in a new, isolated tab", ({ href, id }) => {
    render(<Header />);
    const link = screen.getByTestId(id);

    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each(LINKS)(
    "names $visible by its visible text and says it opens a new tab",
    ({ id, visible }) => {
      render(<Header />);

      // WCAG 2.5.3 Label in Name: speech users say what they see
      expect(screen.getByTestId(id)).toHaveAccessibleName(
        new RegExp(`^${visible} \\(.*opens in a new tab\\)$`),
      );
    },
  );

  it("keeps its icons out of the accessibility tree", () => {
    render(<Header />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    for (const { id } of LINKS) {
      const icon = screen.getByTestId(id).querySelector("svg, img");
      expect(
        icon?.getAttribute("aria-hidden") === "true" ||
          icon?.getAttribute("alt") === "",
      ).toBe(true);
    }
  });
});
