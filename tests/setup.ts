import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// `server-only` lança erro fora do servidor do Next; nos testes é neutralizado.
vi.mock("server-only", () => ({}));
