import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BeaconLogo } from "./beacon-logo";

describe("BeaconLogo", () => {
  it("is exposed to assistive tech as the Beacon logo", () => {
    render(<BeaconLogo />);
    expect(screen.getByRole("img", { name: "Beacon" })).toBeInTheDocument();
  });

  it("can be hidden from assistive tech when it sits next to the product name", () => {
    const { container } = render(<BeaconLogo decorative />);
    expect(screen.queryByRole("img", { name: "Beacon" })).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws the stacked blocks and the three signal arcs on a dark square, and takes a size class", () => {
    const { container } = render(<BeaconLogo className="size-9" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("size-9");
    expect(svg?.querySelectorAll("path[fill='white']")).toHaveLength(3);
    expect(svg?.querySelectorAll("path[stroke='#C1F571']")).toHaveLength(3);
    expect(svg?.querySelector("rect")).not.toBeNull();
  });
});
