import "./globals.css";

export const metadata = {
  title: "How Well Do You Know Centro?",
  description: "Live trivia game — test your Centro knowledge!",
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
