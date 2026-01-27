import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "./button";

describe("Button component", () => {
  it("renders with default variant and size", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("data-variant")).toBe("default");
    expect(button.getAttribute("data-size")).toBe("default");
  });

  it("renders with destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole("button", { name: /delete/i });
    expect(button.getAttribute("data-variant")).toBe("destructive");
  });

  it("renders with different sizes", () => {
    render(<Button size="sm">Small</Button>);

    const button = screen.getByRole("button", { name: /small/i });
    expect(button.getAttribute("data-size")).toBe("sm");
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole("button", { name: /custom/i });
    expect(button.className).toContain("custom-class");
  });

  it("renders as child component when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole("link", { name: /link button/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/test");
  });

  it("passes additional props to the button", () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

describe("buttonVariants", () => {
  it("returns correct classes for default variant", () => {
    const classes = buttonVariants({ variant: "default" });
    expect(classes).toContain("bg-primary");
  });

  it("returns correct classes for outline variant", () => {
    const classes = buttonVariants({ variant: "outline" });
    expect(classes).toContain("border");
    expect(classes).toContain("bg-background");
  });

  it("returns correct classes for different sizes", () => {
    const smClasses = buttonVariants({ size: "sm" });
    const lgClasses = buttonVariants({ size: "lg" });

    expect(smClasses).toContain("h-8");
    expect(lgClasses).toContain("h-10");
  });
});
