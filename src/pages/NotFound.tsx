
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-8 px-4 sm:px-8">
      {/* Video Background */}
      <video
        src="https://res.cloudinary.com/dema3kxng/video/upload/v1765619794/31290-385265697_small_atg1aa.mp4"
        className="absolute inset-0 w-full h-full object-cover brightness-75 contrast-110 blur-[1px] pointer-events-none select-none"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/80 to-background/70 z-10" />

      {/* Subtle Pattern */}
      <div className="absolute inset-0 opacity-10 z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\\"60\\" height=\\"60\\" viewBox=\\"0 0 60 60\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"none\\" fill-rule=\\"evenodd\\"%3E%3Cg fill=\\"%23ffffff\\" fill-opacity=\\"0.7\\"%3E%3Cpath d=\\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\"/%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
      </div>

      {/* Main Content */}
      <div className="container mx-auto z-20 relative flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10 flex flex-col items-center justify-center">
            <h1 className="text-6xl xs:text-7xl sm:text-8xl md:text-9xl font-extrabold text-primary mb-4 tracking-tight drop-shadow-lg">
              404
            </h1>
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-foreground mb-3 drop-shadow">
              Page not found
            </h2>
            <p className="text-muted-foreground text-base xs:text-lg sm:text-xl mb-8 max-w-md sm:max-w-lg mx-auto">
              Sorry, we couldn’t find the page you’re looking for.
            </p>
            <Link
              to="/"
              className="inline-flex items-center text-primary font-semibold text-base xs:text-lg hover:underline transition-colors group bg-background/80 px-5 py-3 rounded-lg shadow-md hover:bg-background/90"
            >
              <span className="mr-2 text-2xl">&#8592;</span> Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default NotFound;
