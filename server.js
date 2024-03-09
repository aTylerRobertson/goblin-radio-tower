require("dotenv").config();
// Express for the server
const express = require("express");
const cors = require("cors");

// FS and Multer for file management
const fs = require("fs");
const multer = require("multer");

// Music-Metadata, Throttle, and Stream for streaming
const mm = require("music-metadata");
const Throttle = require("throttle");
const { PassThrough } = require("stream");

// Body-Parser and Express-Handlebars for the view engine and forms
const bodyparser = require("body-parser");
const { engine } = require("express-handlebars");

// Cookie-Parser and Crypto for really basic auth
const cookieparser = require("cookie-parser");
const { createHash } = require("node:crypto");

// Set up the server
const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static("./static"));
app.use(bodyparser.json());
app.use(cookieparser());
app.use(express.urlencoded({ extended: true }));
app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "./views");

// Prepare the tracklist
const trackFolder = "./static/tracks";
let tracks = [];
const refreshTracks = () => {
  tracks = fs
    .readdirSync(trackFolder)
    .filter((filename) => !filename.startsWith("."));
};

let currentTrack = 0;
const nextTrack = () => {
  refreshTracks();
  if (process.env.SHUFFLE) {
    currentTrack = Math.floor(Math.random() * tracks.length);
  } else {
    currentTrack++;
    if (currentTrack >= tracks.length) currentTrack = 0;
  }
};

const listeners = new Map();

// Prep the storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, trackFolder);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({
  storage: storage,
});

// Index page
app.get("/", (req, res) => {
  res.render("index", {
    title: process.env.STATION_NAME,
    streamURL: `${process.env.ROOT_URL}/stream`,
    contentType: process.env.CONTENT_TYPE,
  });
});

// Admin login page
app.get("/login", (req, res) => {
  res.render("login", {
    title: process.env.STATION_NAME,
  });
});

// Get the stream
app.get("/stream", (req, res) => {
  const { id, stream } = createListener();
  res.type(process.env.CONTENT_TYPE);
  res.status(206);
  stream.pipe(res);
});

// Check whether the viewer is authenticated
const isAuthed = (req, res, next) => {
  const correctAuth = hash(`${process.env.USERNAME}${process.env.PASSWORD}`);

  const authCookie = req.cookies.auth ?? "";
  if (authCookie === correctAuth) return next();

  if (
    `${req.body.username}${req.body.password}` !==
    `${process.env.USERNAME}${process.env.PASSWORD}`
  ) {
    return res.redirect("/login");
  }

  res.cookie("auth", correctAuth, {
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    httpOnly: true,
  });
  next();
};

const hash = (string) => {
  return createHash("sha256").update(string).digest("hex");
};

app.get("/admin", isAuthed, (req, res) => {
  res.render("admin", {
    title: process.env.STATION_NAME,
    auth: `${process.env.USERNAME}${process.env.PASSWORD}`,
    streamURL: `${process.env.ROOT_URL}/stream`,
    contentType: process.env.CONTENT_TYPE,
    tracks,
  });
});

// User has attempted to log in
app.post("/login", isAuthed, (req, res) => {
  refreshTracks();
  res.redirect("/admin");
});

// Upload a file if authenticated
app.post("/upload", upload.single("file"), isAuthed, (req, res) => {
  refreshTracks();
  res.redirect("/admin");
});

// Delete a file if authenticated
app.post("/delete", isAuthed, (req, res) => {
  fs.unlink(`${trackFolder}/${req.body.filename}`, (err) => {
    if (err) console.log(err);
  });

  refreshTracks();
  res.redirect("/admin");
});

// Play files from the tracklist
const play = async (track) => {
  // Return early if there are not enough tracks
  refreshTracks();
  if (tracks.length == 0 || tracks.length < track - 1) return;

  // Get the current file
  const filePath = `${trackFolder}/${tracks[track]}`;
  const songReadable = fs.createReadStream(filePath);
  const fileData = await mm.parseFile(filePath);
  const bitRate = fileData.format.bitrate / 8;

  // Throttle the stream to the file's bitrate (so it plays smoothly)
  const throttleTransformable = new Throttle(bitRate);
  songReadable.pipe(throttleTransformable);

  // For each chunk of data,
  throttleTransformable.on("data", (chunk) => {
    // send the chunk to all users
    broadcast(chunk);
  });

  // Catch any errors with the file
  throttleTransformable.on("error", (e) => {
    console.log(err);
    nextTrack();
    play(currentTrack);
  });

  // When the file is played, or the track has been switched, go to next
  throttleTransformable.on("end", () => {
    nextTrack();
    play(currentTrack);
  });
};

// Broadcasts given chunk to all current listeners
const broadcast = (chunk) => {
  for (let [id, stream] of listeners) {
    stream.write(chunk);
  }
};

// Creates a new listener, to help us make sure everyone hears the same thing
const createListener = () => {
  const id = Math.random().toString(36).slice(2);
  const stream = new PassThrough();
  listeners.set(id, stream);
  return { id, stream };
};

// Start the server!
app.listen(port, () => {
  console.log(`Listening on ${port}, m'lord!`);
  play(currentTrack);
});
