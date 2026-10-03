import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentComposer } from "./comment-composer";
import type { User } from "@/lib/types";

const mockCreateComment = vi.fn();
vi.mock("@/hooks/use-comments", () => ({ useCreateComment: () => mockCreateComment }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "me" } }) }));
const mockToastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args) } }));

const candidates: User[] = [
  { id: "u1", name: "Fachril Zulfidar", email: "f@x.id", avatarUrl: null, organizationId: null, createdAt: "t" },
  { id: "u2", name: "Sari", email: "s@x.id", avatarUrl: null, organizationId: null, createdAt: "t" },
];

function renderComposer(onSubmitted = vi.fn()) {
  render(<CommentComposer pageId="page-1" blockId="block-1" candidates={candidates} onSubmitted={onSubmitted} />);
  return {
    onSubmitted,
    input: screen.getByRole("textbox") as HTMLTextAreaElement,
    send: () => screen.getByRole("button", { name: "Kirim" }),
  };
}

describe("CommentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateComment.mockResolvedValue({ id: "c1" });
  });

  it("disables Kirim until there is text, then posts the trimmed comment for the block", async () => {
    const user = userEvent.setup();
    const { input, send, onSubmitted } = renderComposer();
    expect(send()).toBeDisabled();

    await user.type(input, "  Tolong perjelas  ");
    await user.click(send());

    expect(mockCreateComment).toHaveBeenCalledWith("page-1", "block-1", "me", "Tolong perjelas", []);
    await vi.waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(input.value).toBe("");
  });

  it("lists matching Space members after @ and narrows as a multi-word name is typed", async () => {
    const user = userEvent.setup();
    const { input } = renderComposer();
    await user.type(input, "@");
    expect(screen.getByRole("option", { name: "Fachril Zulfidar" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sari" })).toBeInTheDocument();

    await user.type(input, "Fachril Zul");
    expect(screen.getByRole("option", { name: "Fachril Zulfidar" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sari" })).not.toBeInTheDocument();
  });

  it("inserts the picked mention and sends that user's id with the comment", async () => {
    const user = userEvent.setup();
    const { input, send } = renderComposer();
    await user.type(input, "cek ini @Sa");
    await user.click(screen.getByRole("option", { name: "Sari" }));
    expect(input.value).toBe("cek ini @Sari ");

    await user.click(send());
    expect(mockCreateComment).toHaveBeenCalledWith("page-1", "block-1", "me", "cek ini @Sari", ["u2"]);
  });

  it("does not notify someone whose mention was deleted from the text before sending", async () => {
    const user = userEvent.setup();
    const { input, send } = renderComposer();
    await user.type(input, "@Sa");
    await user.click(screen.getByRole("option", { name: "Sari" }));
    await user.clear(input);
    await user.type(input, "tanpa mention");
    await user.click(send());

    expect(mockCreateComment).toHaveBeenCalledWith("page-1", "block-1", "me", "tanpa mention", []);
  });

  it("keeps the draft and shows an error toast when posting fails", async () => {
    mockCreateComment.mockRejectedValueOnce(new Error("denied"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const { input, send, onSubmitted } = renderComposer();
    await user.type(input, "Halo");
    await user.click(send());

    await vi.waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(input.value).toBe("Halo");
    expect(onSubmitted).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not post twice while a send is in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    mockCreateComment.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    const { input, send } = renderComposer();
    await user.type(input, "Halo");
    await user.click(send());
    expect(send()).toBeDisabled();
    await user.click(send());
    expect(mockCreateComment).toHaveBeenCalledTimes(1);
    resolve({ id: "c1" });
  });

  describe("keyboard picking (like Discord)", () => {
    it("highlights the first match as soon as the picker opens", async () => {
      const user = userEvent.setup();
      const { input } = renderComposer();
      await user.type(input, "@");
      expect(screen.getByRole("option", { name: "Fachril Zulfidar" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("option", { name: "Sari" })).toHaveAttribute("aria-selected", "false");
    });

    it("Tab picks the highlighted person and keeps the focus in the comment box", async () => {
      const user = userEvent.setup();
      const { input, send } = renderComposer();
      await user.type(input, "cek @Fa");
      await user.keyboard("{Tab}");

      expect(input.value).toBe("cek @Fachril Zulfidar ");
      expect(input).toHaveFocus();
      await user.click(send());
      expect(mockCreateComment).toHaveBeenCalledWith("page-1", "block-1", "me", "cek @Fachril Zulfidar", ["u1"]);
    });

    it("ArrowDown moves the highlight and Enter picks that person (no newline is added)", async () => {
      const user = userEvent.setup();
      const { input } = renderComposer();
      await user.type(input, "@");
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("option", { name: "Sari" })).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{Enter}");
      expect(input.value).toBe("@Sari ");
    });

    it("ArrowUp from the first match wraps to the last, and ArrowDown from the last wraps to the first", async () => {
      const user = userEvent.setup();
      const { input } = renderComposer();
      await user.type(input, "@");
      await user.keyboard("{ArrowUp}");
      expect(screen.getByRole("option", { name: "Sari" })).toHaveAttribute("aria-selected", "true");
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("option", { name: "Fachril Zulfidar" })).toHaveAttribute("aria-selected", "true");
      expect(input.value).toBe("@");
    });

    it("typing more resets the highlight to the first match of the narrowed list", async () => {
      const user = userEvent.setup();
      const { input } = renderComposer();
      await user.type(input, "@");
      await user.keyboard("{ArrowDown}");
      await user.type(input, "S");
      expect(screen.getByRole("option", { name: "Sari" })).toHaveAttribute("aria-selected", "true");
      await user.keyboard("{Tab}");
      expect(input.value).toBe("@Sari ");
    });

    it("Escape closes the picker, leaves the text alone, and does not bubble up to close the side panel", async () => {
      const user = userEvent.setup();
      const { input } = renderComposer();
      await user.type(input, "@Fa");
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      input.dispatchEvent(escape);

      await vi.waitFor(() => expect(screen.queryByRole("option", { name: "Fachril Zulfidar" })).not.toBeInTheDocument());
      expect(escape.defaultPrevented).toBe(true);
      expect(input.value).toBe("@Fa");
    });

    it("Tab with no picker open moves focus on normally", async () => {
      const user = userEvent.setup();
      const { input, send } = renderComposer();
      await user.type(input, "halo");
      await user.tab();
      expect(input).not.toHaveFocus();
      expect(send()).toHaveFocus();
    });

    it("Enter with no picker open does not send the comment", async () => {
      const user = userEvent.setup();
      const { input } = renderComposer();
      await user.type(input, "halo{Enter}");
      expect(mockCreateComment).not.toHaveBeenCalled();
    });
  });
});
