import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { QueryProvider } from "./query-provider";

const QueryClientConsumer = () => {
  const queryClient = useQueryClient();
  return <div>{queryClient ? "query-client-ready" : "query-client-missing"}</div>;
};

describe("QueryProvider", () => {
  it("renders children", () => {
    render(
      <QueryProvider>
        <div>child-content</div>
      </QueryProvider>
    );

    expect(screen.getByText("child-content")).toBeDefined();
  });

  it("provides a query client context", () => {
    render(
      <QueryProvider>
        <QueryClientConsumer />
      </QueryProvider>
    );

    expect(screen.getByText("query-client-ready")).toBeDefined();
  });
});
