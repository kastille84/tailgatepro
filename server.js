if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cron = require("node-cron");

// middlewares
const { errorHandler } = require("./server/middlewares/errorHandler");

// routes
const waitlistRoutes = require("./server/routes/waitlist");
const usersRoutes = require("./server/routes/users");
// const authRoutes = require("./server/routes/auth");
// const assetRoutes = require("./server/routes/assets");
// const moderateRoutes = require("./server/routes/moderate");
// const emailRoutes = require("./server/routes/emails");
// const stripeRoutes = require("./server/routes/stripe");
// const {
//   deleteFlaggedFlyers,
//   deleteExpiredFlyers,
//   deleteUnregisteredFlyers,
// } = require("./server/controllers/flyers");

const app = express();

if ((process.env.NODE_ENV || "").toLowerCase() === "production") {
  const corsOptions = {
    // Explicitly list both versions of your domain
    origin: ["https://getTailgatePro.com", "https://www.getTailgatePro.com"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Set to true if you are using cookies or sessions
  };

  app.use(cors(corsOptions));
  // Handle preflight for all routes (important for 'Response to preflight' errors)
  app.options("*", cors(corsOptions));
} else {
  app.use(cors());
}

// for handling stripe webhooks
// app.use("/webhook", stripeRoutes);

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/waitlist", waitlistRoutes);
app.use("/api/users", usersRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/assets", assetRoutes);
// app.use("/api/moderate", moderateRoutes);
// app.use("/api/email", emailRoutes);
// app.use("/api/stripe", stripeRoutes);

/****  C R O N   J O B S *****/
// cron jobs - delete flagged flyers
// cron.schedule("* * * * *", () => {
cron.schedule("0 5 * * *", () => {
  console.log("running delete Flagged Flyers task at 5am every day");
  deleteFlaggedFlyers();
});

// TODO: turn this OFF when Leaflit is operational in 3 communities
// cron jobs - delete old flyers
// cron.schedule("* * * * *", () => {
// cron.schedule("0 5 * * *", () => {
//   console.log("running delete Unregistered Flyers task at 5am every day");
//   deleteUnregisteredFlyers();
// });

// TODO: turn this on once we've seeded a lot of flyers
// cron jobs - delete old flyers
// cron.schedule("0 5 * * *", () => {
//   console.log("running delete Expired Flyers task at 5am every day");
//   deleteExpiredFlyers();
// });

// general error handling
// catches whenever an error is thrown or forwarded with next()
app.use(errorHandler);

app.use(express.static(path.join(__dirname, "./client/dist")));

app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "./client/dist", "index.html"));
});

const port = 5000;
app.listen(process.env.PORT || port, () =>
  console.log("Server running on port :" + (process.env.PORT || port)),
);
