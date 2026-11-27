import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AirChess — Your next move, in the air.",
  authors: [{ name: "Harsh Agarwal", url: "https://github.com/harshagarwal4761" }],
  creator: "Harsh Agarwal",
  description:
    "Play chess hands-free through your webcam, challenge local Stockfish AI, or host live online rooms with blitz clocks.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "AirChess — Your next move, in the air.",
    description:
      "Hands-free webcam chess powered by MediaPipe & a custom gesture classifier, local Stockfish WASM AI, and real-time online rooms.",
    type: "website",
    siteName: "AirChess",
  },
  twitter: {
    card: "summary",
    title: "AirChess — Your next move, in the air.",
    description:
      "Hands-free webcam chess, local Stockfish WASM AI, and live online multiplayer rooms.",
  },
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
