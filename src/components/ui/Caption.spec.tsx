import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Caption } from "@/components/ui/Caption";

describe("Caption", () => {
  it("renders empty span for empty text", () => {
    const { container } = render(<Caption text="" />);
    expect(container.firstChild).toEqual(
      expect.objectContaining({ tagName: "SPAN" }),
    );
    expect(container.firstChild?.textContent).toBe("");
  });

  it("renders empty span for whitespace text", () => {
    const { container } = render(<Caption text="   " />);
    expect(container.firstChild).toEqual(
      expect.objectContaining({ tagName: "SPAN" }),
    );
    expect(container.firstChild?.textContent).toBe("");
  });

  it("renders empty span for &nbsp;", () => {
    const { container } = render(<Caption text="" />);
    expect(container.firstChild).toEqual(
      expect.objectContaining({ tagName: "SPAN" }),
    );
    expect(container.firstChild?.textContent).toBe("");
  });

  it("renders plain text without HTML", () => {
    render(<Caption text="Simple text" />);
    expect(screen.getByText("Simple text")).toBeInTheDocument();
  });

  it("renders text with HTML img tags as React images", () => {
    const htmlText =
      "Eastern Palace <img src='/assets/bow2.png' class='mini'/>";
    const { container } = render(<Caption text={htmlText} />);

    expect(screen.getByText("Eastern Palace")).toBeInTheDocument();

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/assets/bow2.png");
    expect(img).toHaveAttribute("class", "mini");
    expect(img).toHaveAttribute("alt", "Game item icon");
  });

  it("renders multiple images in text", () => {
    const htmlText =
      "Desert Palace <img src='/assets/glove1.png' class='mini'/>  <img src='/assets/book.png' class='mini'/>  <img src='/assets/lantern.png' class='mini'/>";
    const { container } = render(<Caption text={htmlText} />);

    expect(screen.getByText("Desert Palace")).toBeInTheDocument();

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(3);

    expect(images[0]).toHaveAttribute("src", "/assets/glove1.png");
    expect(images[1]).toHaveAttribute("src", "/assets/book.png");
    expect(images[2]).toHaveAttribute("src", "/assets/lantern.png");

    images.forEach((img) => {
      expect(img).toHaveAttribute("class", "mini");
    });
  });

  it("handles img tags without class attribute", () => {
    const htmlText = "Test <img src='/assets/test.png'>";
    const { container } = render(<Caption text={htmlText} />);

    expect(screen.getByText("Test")).toBeInTheDocument();

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/assets/test.png");
    expect(img).toHaveAttribute("class", "");
  });

  it("handles complex text with multiple parts", () => {
    const htmlText =
      "King's Tomb <img src='/assets/boots.png' class='mini'> + <img src='/assets/glove2.png' class='mini'>/<img src='/assets/mirror.png' class='mini'>";
    const { container } = render(<Caption text={htmlText} />);

    // Check that text parts are rendered using partial text matching
    expect(screen.getByText(/King's Tomb/)).toBeInTheDocument();
    expect(screen.getByText(/\+/)).toBeInTheDocument();
    expect(screen.getByText(/\//)).toBeInTheDocument();

    // Check that images are rendered
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(3);

    expect(images[0]).toHaveAttribute("src", "/assets/boots.png");
    expect(images[1]).toHaveAttribute("src", "/assets/glove2.png");
    expect(images[2]).toHaveAttribute("src", "/assets/mirror.png");
  });

  it("handles self-closing img tags", () => {
    const htmlText = "Test <img src='/assets/test.png' class='mini'/>";
    const { container } = render(<Caption text={htmlText} />);

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/assets/test.png");
    expect(img).toHaveAttribute("class", "mini");
  });

  it("handles img tags with double quotes", () => {
    const htmlText = 'Test <img src="/assets/test.png" class="mini">';
    const { container } = render(<Caption text={htmlText} />);

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/assets/test.png");
    expect(img).toHaveAttribute("class", "mini");
  });
});
