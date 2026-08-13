import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

describe("DeleteConfirmDialog", () => {
  it("renders the title and description when open", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Hapus Space ini?"
        description="Semua Halaman di dalamnya akan ikut terhapus."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Hapus Space ini?")).toBeInTheDocument();
    expect(screen.getByText("Semua Halaman di dalamnya akan ikut terhapus.")).toBeInTheDocument();
  });

  it("calls onConfirm when the destructive button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog open={true} onOpenChange={vi.fn()} title="Hapus?" description="..." onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole("button", { name: "Hapus" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange(false) when Batal is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <DeleteConfirmDialog open={true} onOpenChange={onOpenChange} title="Hapus?" description="..." onConfirm={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a busy label and disables both buttons while isDeleting", () => {
    render(
      <DeleteConfirmDialog open={true} onOpenChange={vi.fn()} title="Hapus?" description="..." onConfirm={vi.fn()} isDeleting />,
    );

    expect(screen.getByRole("button", { name: "Menghapus…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Batal" })).toBeDisabled();
  });

  it("supports a custom confirm label", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Hapus?"
        description="..."
        onConfirm={vi.fn()}
        confirmLabel="Hapus Halaman"
      />,
    );

    expect(screen.getByRole("button", { name: "Hapus Halaman" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <DeleteConfirmDialog open={false} onOpenChange={vi.fn()} title="Hapus?" description="..." onConfirm={vi.fn()} />,
    );

    expect(screen.queryByText("Hapus?")).not.toBeInTheDocument();
  });
});
