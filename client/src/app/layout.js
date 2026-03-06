import "./globals.css";

export const metadata = {
  title: "Centro Trivia",
  description: "Live trivia game powered by Centro",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-centro-dark text-centro-white font-roboto antialiased">
        {children}
      </body>
    </html>
  );
}
