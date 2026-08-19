import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { requestImageFile } from "./file-select-singleton";

function makeImageFile(name = "photo.png") {
  return new File(["fake-image-bytes"], name, { type: "image/png" });
}

describe("requestImageFile", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("appends exactly one hidden file input to document.body, reused across calls", () => {
    requestImageFile(() => {});
    requestImageFile(() => {});
    expect(document.body.querySelectorAll('input[type="file"]').length).toBe(1);
  });

  it("scopes the input to images only", () => {
    requestImageFile(() => {});
    const input = document.body.querySelector('input[type="file"]');
    expect(input).toHaveAttribute("accept", "image/*");
  });

  it("invokes the registered callback with the selected file when the input changes", async () => {
    const onSelect: File[] = [];
    requestImageFile((file) => onSelect.push(file));
    const input = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeImageFile();
    await userEvent.upload(input, file);
    expect(onSelect).toEqual([file]);
  });

  it(
    "keeps working after the calling React component unmounts, simulating BlockNote's " +
      "dev-mode NodeView remount tearing down whatever rendered the request",
    async () => {
      const selected: File[] = [];
      function Caller() {
        return (
          <button type="button" onClick={() => requestImageFile((file) => selected.push(file))}>
            pick
          </button>
        );
      }
      const { getByText, unmount } = render(<Caller />);
      await userEvent.click(getByText("pick"));

      // The component that made the request is gone — a locally-owned <input>
      // would have been removed from the DOM along with it.
      unmount();

      const input = document.body.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      const file = makeImageFile();
      await userEvent.upload(input as HTMLInputElement, file);
      expect(selected).toEqual([file]);
    },
  );

  it("only invokes the most recently registered callback", async () => {
    const first: File[] = [];
    const second: File[] = [];
    requestImageFile((file) => first.push(file));
    requestImageFile((file) => second.push(file));

    const input = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeImageFile();
    await userEvent.upload(input, file);

    expect(first).toEqual([]);
    expect(second).toEqual([file]);
  });
});
