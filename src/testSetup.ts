import { afterEach } from "vitest";

afterEach(() => {
  localStorage.clear();
  window.location.hash = "";
});
