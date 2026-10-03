import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";
import GuestSetupPage from "./GuestSetupPage";

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("Guest compatibility onboarding", () => {
  it("uses one generated identity and enters normal Offline2P instead of a Guest mode", async () => {
    renderWithProviders(<><GuestSetupPage /><LocationProbe /></>, "/guest");
    const input = await screen.findByLabelText("Tên khách");
    await waitFor(() => expect((input as HTMLInputElement).value).not.toBe(""));
    expect((input as HTMLInputElement).value).toMatch(/^Khách /);
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/offline"));
  });
});
