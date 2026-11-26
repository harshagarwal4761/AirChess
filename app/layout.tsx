import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AirChess — Your next move, in the air.",
  authors: [{ name: "Harsh Agarwal", url: "https://github.com/harshagarwal4761" }],
  creator: "Harsh Agarwal",
  description:
    "A floating chessboard. A simple hand gesture. Play chess with a friend, right through your camera.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
