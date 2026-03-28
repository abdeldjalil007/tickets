import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ticket System",
  description: "Ticket submission and confirmation platform",
  icons: {
    icon: [
      { url: "/assets/fav16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/fav32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/fav96x96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "/assets/fav32x32.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased app-shell`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
