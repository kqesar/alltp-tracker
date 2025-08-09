import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GridItem } from "./GridItem";

// Mock the child components
vi.mock("../items/BossItem", () => ({
  BossItem: ({
    bossNumber,
    col,
    item,
    row,
  }: {
    bossNumber: number;
    col: number;
    item: string;
    row: number;
  }) => (
    <div
      data-boss={bossNumber}
      data-col={col}
      data-item={item}
      data-row={row}
      data-testid="boss-item"
    >
      Boss Item {bossNumber}
    </div>
  ),
}));

vi.mock("../items/RegularItem", () => ({
  RegularItem: ({
    col,
    item,
    row,
  }: {
    col: number;
    item: string;
    row: number;
  }) => (
    <div
      data-col={col}
      data-item={item}
      data-row={row}
      data-testid="regular-item"
    >
      Regular Item {item}
    </div>
  ),
}));

describe("GridItem", () => {
  describe("Boss items", () => {
    it("should render BossItem for boss0", () => {
      render(<GridItem col={6} item="boss0" row={1} />);

      const bossItem = screen.getByTestId("boss-item");
      expect(bossItem).toBeInTheDocument();
      expect(bossItem).toHaveAttribute("data-boss", "0");
      expect(bossItem).toHaveAttribute("data-col", "6");
      expect(bossItem).toHaveAttribute("data-item", "boss0");
      expect(bossItem).toHaveAttribute("data-row", "1");
    });

    it("should render BossItem for boss1", () => {
      render(<GridItem col={6} item="boss1" row={2} />);

      const bossItem = screen.getByTestId("boss-item");
      expect(bossItem).toBeInTheDocument();
      expect(bossItem).toHaveAttribute("data-boss", "1");
      expect(bossItem).toHaveAttribute("data-col", "6");
      expect(bossItem).toHaveAttribute("data-item", "boss1");
      expect(bossItem).toHaveAttribute("data-row", "2");
    });

    it("should render BossItem for boss9", () => {
      render(<GridItem col={6} item="boss9" row={5} />);

      const bossItem = screen.getByTestId("boss-item");
      expect(bossItem).toBeInTheDocument();
      expect(bossItem).toHaveAttribute("data-boss", "9");
      expect(bossItem).toHaveAttribute("data-col", "6");
      expect(bossItem).toHaveAttribute("data-item", "boss9");
      expect(bossItem).toHaveAttribute("data-row", "5");
    });

    it("should correctly parse multi-digit boss numbers", () => {
      render(<GridItem col={0} item="boss12" row={0} />);

      const bossItem = screen.getByTestId("boss-item");
      expect(bossItem).toBeInTheDocument();
      expect(bossItem).toHaveAttribute("data-boss", "12");
    });
  });

  describe("Regular items", () => {
    it("should render RegularItem for sword", () => {
      render(<GridItem col={3} item="sword" row={1} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
      expect(regularItem).toHaveAttribute("data-col", "3");
      expect(regularItem).toHaveAttribute("data-item", "sword");
      expect(regularItem).toHaveAttribute("data-row", "1");
    });

    it("should render RegularItem for hookshot", () => {
      render(<GridItem col={1} item="hookshot" row={0} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
      expect(regularItem).toHaveAttribute("data-col", "1");
      expect(regularItem).toHaveAttribute("data-item", "hookshot");
      expect(regularItem).toHaveAttribute("data-row", "0");
    });

    it("should render RegularItem for empty string", () => {
      render(<GridItem col={0} item="" row={0} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
      expect(regularItem).toHaveAttribute("data-col", "0");
      expect(regularItem).toHaveAttribute("data-item", "");
      expect(regularItem).toHaveAttribute("data-row", "0");
    });

    it("should render RegularItem for agahnim", () => {
      render(<GridItem col={6} item="agahnim" row={4} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
      expect(regularItem).toHaveAttribute("data-col", "6");
      expect(regularItem).toHaveAttribute("data-item", "agahnim");
      expect(regularItem).toHaveAttribute("data-row", "4");
    });
  });

  describe("Edge cases", () => {
    it("should render RegularItem for null item", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with null
      render(<GridItem col={0} item={null as any} row={0} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
    });

    it("should render RegularItem for undefined item", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with undefined
      render(<GridItem col={0} item={undefined as any} row={0} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
    });

    it("should render RegularItem for item containing 'boss' but not starting with it", () => {
      render(<GridItem col={0} item="notboss" row={0} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
      expect(regularItem).toHaveAttribute("data-item", "notboss");
    });

    it("should render RegularItem for item containing 'boss' in the middle", () => {
      render(<GridItem col={0} item="somebossitem" row={0} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toBeInTheDocument();
      expect(regularItem).toHaveAttribute("data-item", "somebossitem");
    });
  });

  describe("Props passing", () => {
    it("should pass all props correctly to BossItem", () => {
      render(<GridItem col={88} item="boss7" row={99} />);

      const bossItem = screen.getByTestId("boss-item");
      expect(bossItem).toHaveAttribute("data-boss", "7");
      expect(bossItem).toHaveAttribute("data-col", "88");
      expect(bossItem).toHaveAttribute("data-item", "boss7");
      expect(bossItem).toHaveAttribute("data-row", "99");
    });

    it("should pass all props correctly to RegularItem", () => {
      render(<GridItem col={66} item="testitem" row={77} />);

      const regularItem = screen.getByTestId("regular-item");
      expect(regularItem).toHaveAttribute("data-col", "66");
      expect(regularItem).toHaveAttribute("data-item", "testitem");
      expect(regularItem).toHaveAttribute("data-row", "77");
    });
  });
});
