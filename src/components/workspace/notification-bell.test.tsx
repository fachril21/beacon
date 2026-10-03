import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./notification-bell";
import type { Notification } from "@/lib/types";

const markRead = vi.fn();
const notifications: Notification[] = [
  {
    id: "n-1",
    recipientUserId: "me",
    actorUserId: "u2",
    pageId: "page-1",
    commentId: "c-1",
    isRead: false,
    createdAt: "2026-01-02T00:00:00.000Z",
    commentBody: "Tolong cek bagian ini @me",
  },
];

vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => notifications,
  useMarkNotificationRead: () => markRead,
  useUnreadNotificationCount: () => notifications.filter((n) => !n.isRead).length,
}));
// A profile with no name: the notification must still say who it was, by email.
vi.mock("@/hooks/use-users", () => ({ useUser: () => ({ id: "u2", name: "", email: "sari.dewi@example.com" }) }));
vi.mock("@/hooks/use-pages", () => ({ usePage: () => ({ id: "page-1", spaceId: "space-1", title: "Panduan Login" }) }));

async function openBell() {
  const user = userEvent.setup();
  render(<NotificationBell />);
  await user.click(screen.getByRole("button", { name: /Notifikasi/ }));
  return user;
}

describe("NotificationBell", () => {
  it("says who tagged you (full email when they have no name), on which page, and shows the comment", async () => {
    await openBell();
    expect(screen.getByText("sari.dewi@example.com")).toBeInTheDocument();
    expect(screen.getByText("Panduan Login")).toBeInTheDocument();
    expect(screen.getByText("Tolong cek bagian ini @me")).toBeInTheDocument();
  });

  it("links to the page with the tagging comment, and marks the notification read on click", async () => {
    const user = await openBell();
    const link = screen.getByRole("link", { name: /sari\.dewi@example\.com/ });
    expect(link).toHaveAttribute("href", "/spaces/space-1/pages/page-1?comment=c-1");

    await user.click(link);
    expect(markRead).toHaveBeenCalledWith("n-1");
  });

  it("marks an unread notification visibly", async () => {
    await openBell();
    expect(screen.getByLabelText("Belum dibaca")).toBeInTheDocument();
  });
});
