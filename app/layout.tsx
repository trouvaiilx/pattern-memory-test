import "./globals.css";

export const metadata = {
  title: "Pattern Memory Test",
  description: "Test patterns systematically to find your forgotten lock",
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
